/**
 * Output validation (plan §7.8): zod schemas for both data files, cross-reference checks, and obtainability
 * coverage: every species `1..nationalDexMax` must be obtainable or have a reason in every game (plan §9).
 * Story milestones (plan §7.14) are checked against locations, walkthroughs, unlocks and encounters.
 */
import { z } from 'zod';
import type { PokedexData, VersionGroupData } from '../../../src/app/core/domain/models';
import {
  buildChecklist,
  maxInOneSave,
  type ChecklistEntry,
} from '../../../src/app/core/domain/obtainability';
import { isKnownMethod } from '../../../src/app/core/games/methods';
import { POKEMON_TYPES } from '../../../src/app/core/games/pokemon-types';
import { findGame, getVersionGroup } from '../../../src/app/core/games/registry';
import type { GameId, VersionGroupId } from '../../../src/app/core/games/types';
import type { BuildIssue } from './assemble';

const int = z.int();
const positive = z.int().positive();
/** Learnset rows limited to some games (`games` absent: every game). */
const gameRows = z.array(
  z.strictObject({ move: z.string().min(1), games: z.array(z.string()).optional() }),
);
const typeId = z.enum(POKEMON_TYPES.map((t) => t.id) as [string, ...string[]]);
const gameRecord = <T extends z.ZodType>(value: T) => z.record(z.string(), value);
const sourceShort = z.strictObject({ title: z.string().min(1), revid: positive });

const levels = z
  .strictObject({ min: positive, max: positive, values: z.array(positive).optional() })
  .refine((l) => l.min <= l.max, 'min is greater than max');

const rate = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('percent'), value: z.number().positive().max(100) }),
  z.strictObject({ kind: z.literal('once') }),
  z.strictObject({ kind: z.literal('price'), value: int.nonnegative() }),
  z.strictObject({ kind: z.literal('coins'), value: positive }),
  z.strictObject({ kind: z.literal('unknown'), text: z.string() }),
]);

/** A story battle's team (plan §7.14, Phase 19). */
const trainerTeam = z.strictObject({
  trainer: z.string().min(1),
  trainerClass: z.string().min(1).optional(),
  prize: positive.optional(),
  variant: z
    .discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('starter'), dex: positive }),
      z.strictObject({ kind: z.literal('rival-eevee'), dex: positive, evolved: z.boolean() }),
    ])
    .optional(),
  pokemon: z
    .array(
      z.strictObject({
        dex: positive,
        level: positive.max(100),
        gender: z.enum(['male', 'female']).optional(),
        moves: z.array(z.strictObject({ name: z.string().min(1), type: typeId })).max(4),
      }),
    )
    .min(1)
    .max(6),
});

const slot = z.strictObject({
  levels: levels.nullable(),
  rate,
  conditions: z.array(z.looseObject({ kind: z.string() })).optional(),
  ivs: z
    .discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('fixed'),
        values: z.partialRecord(
          z.enum(['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'spc']),
          int.min(0).max(31),
        ),
      }),
      z.strictObject({ kind: z.literal('min-perfect'), count: positive.max(6) }),
    ])
    .optional(),
  shiny: z.enum(['locked', 'guaranteed']).optional(),
  catchRateOverride: positive.optional(),
  note: z.string().optional(),
});

const encounter = z.strictObject({
  dex: positive,
  method: z.string().min(1),
  games: gameRecord(z.array(slot).min(1)),
  requires: z.array(z.string().min(1)).optional(),
  exclusiveGroupId: z.string().min(1).optional(),
  trade: z.strictObject({ giveDex: positive, nickname: z.string().min(1).optional() }).optional(),
  label: z.string().min(1).optional(),
  note: z.string().optional(),
});

const item = z.strictObject({
  no: positive,
  itemId: z.string().min(1),
  name: z.string().min(1),
  quantity: positive,
  games: z.array(z.string()).min(1),
  obtain: z.enum(['pickup', 'gift', 'reward', 'drop', 'choice', 'purchase']),
  hidden: z.literal(true).optional(),
  subArea: z.string().nullable(),
  where: z.string(),
  requires: z.array(z.array(z.string().min(1)).min(1)).optional(),
  coins: positive.optional(),
  fromPart: gameRecord(positive).optional(),
  choiceGroupId: z.string().min(1).optional(),
  source: sourceShort.optional(),
});

const location = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  kind: z.enum(['town', 'route', 'cave', 'building', 'water', 'special']),
  placement: gameRecord(z.strictObject({ part: positive, order: int.nonnegative() })),
  source: sourceShort,
  notes: z.array(z.string()),
  subAreas: z.array(
    z.strictObject({
      id: z.string().min(1),
      name: z.string().nullable(),
      encounters: z.array(encounter),
    }),
  ),
  items: z.array(item),
  itemNotes: z.array(
    z.union([z.string(), z.strictObject({ text: z.string(), games: z.array(z.string()).min(1) })]),
  ),
});

const statRecord = z.partialRecord(
  z.enum(['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'spc']),
  int.nonnegative(),
);

const species = z.strictObject({
  dex: positive,
  name: z.string().min(1),
  slug: z.string().min(1),
  types: z.union([z.tuple([typeId]), z.tuple([typeId, typeId])]),
  regionalDex: gameRecord(positive).optional(),
  catchRate: positive.max(255),
  catchRateByGame: gameRecord(positive.max(255)).optional(),
  catchRateNote: z.string().optional(),
  baseStats: statRecord,
  category: z.string().min(1),
  heightM: z.number().nonnegative(),
  weightKg: z.number().nonnegative(),
  baseExp: int.nonnegative(),
  growthRate: z.enum(['erratic', 'fast', 'medium-fast', 'medium-slow', 'slow', 'fluctuating']),
  evYield: statRecord.optional(),
  eggGroups: z.array(z.string()).optional(),
  genderRatio: z.union([z.number().min(0).max(1), z.literal('genderless')]).optional(),
});

const sourceRef = z.strictObject({ title: z.string().min(1), revid: positive, url: z.url() });

export const versionGroupDataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  versionGroupId: z.string().min(1),
  generation: positive,
  games: z.array(z.string()).min(1),
  builtAt: z.string(),
  types: z.array(typeId).min(1),
  species: z.array(species),
  evolutions: z.array(
    z.strictObject({
      from: positive,
      to: positive,
      trigger: z.enum(['level', 'item', 'trade', 'friendship', 'other']),
      level: positive.optional(),
      item: z.string().optional(),
      heldItem: z.string().optional(),
      timeOfDay: z.enum(['morning', 'day', 'night']).optional(),
      stat: z.enum(['atk>def', 'atk<def', 'atk=def']).optional(),
      condition: z.string().optional(),
      requiresTrade: z.boolean(),
      games: z.array(z.string()).optional(),
    }),
  ),
  breeding: z
    .strictObject({
      dayCareLocationIds: z.array(z.string()),
      dittoDex: positive,
      babyItemRequirements: z
        .array(z.strictObject({ offspring: positive, item: z.string() }))
        .optional(),
    })
    .nullable(),
  walkthroughs: gameRecord(
    z.array(
      z.strictObject({ part: positive, title: z.string().min(1), region: z.string().min(1) }),
    ),
  ),
  unlocks: gameRecord(
    z.array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().min(1),
        kind: z.enum(['move', 'key-item', 'badge', 'story']),
        locationId: z.string().min(1),
        part: positive,
      }),
    ),
  ),
  exclusiveGroups: z.array(
    z.strictObject({
      id: z.string().min(1),
      label: z.string().min(1),
      games: z.array(z.string()).min(1),
      members: z.array(positive).min(2),
    }),
  ),
  eventOnly: z.array(positive),
  requiresOtherGame: z
    .array(z.strictObject({ dex: z.array(positive).min(1), detail: z.string().min(1) }))
    .optional(),
  locations: z.array(location),
  milestones: z
    .array(
      z.strictObject({
        no: positive,
        id: z.string().min(1),
        label: z.string().min(1),
        kind: z.enum(['gym', 'battle', 'event', 'key-item', 'encounter', 'gift']),
        part: gameRecord(positive).refine((r) => Object.keys(r).length > 0, 'names no game'),
        locationId: z.string().min(1),
        after: z.string().min(1).optional(),
        detail: z.string().min(1).optional(),
        badge: z.string().min(1).optional(),
        grants: z.array(z.string().min(1)).min(1).optional(),
        dex: positive.optional(),
        optional: z.literal(true).optional(),
        teams: gameRecord(z.array(trainerTeam).min(1)).optional(),
      }),
    )
    .optional(),
  sources: z.array(sourceRef),
});

export const pokedexDataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  versionGroupId: z.string().min(1),
  builtAt: z.string(),
  moves: z.array(
    z.strictObject({
      id: z.string().min(1),
      name: z.string().min(1),
      type: typeId,
      power: positive.nullable(),
      accuracy: z.number().positive().max(100).nullable(),
      pp: positive,
      machine: z
        .string()
        .regex(/^(?:TM|HM)\d{2}$/)
        .optional(),
    }),
  ),
  learnsets: z.record(
    z.string().regex(/^\d+$/),
    z.strictObject({
      levelUp: z.array(
        z.strictObject({ move: z.string().min(1), levels: gameRecord(int.nonnegative()) }),
      ),
      machines: z.array(z.string().min(1)),
      prevo: z.array(
        z.strictObject({
          move: z.string().min(1),
          fromDex: z.array(positive).min(1),
          games: z.array(z.string()).optional(),
        }),
      ),
      egg: gameRows.optional(),
      tutor: gameRows.optional(),
    }),
  ),
  entries: z.record(
    z.string().regex(/^\d+$/),
    z.array(z.strictObject({ games: z.array(z.string()).min(1), text: z.string().min(1) })),
  ),
  sources: z.array(sourceRef),
});

export interface GameChecklist {
  game: GameId;
  entries: ChecklistEntry[];
  maxInOneSave: number;
}

export interface ValidationResult {
  issues: BuildIssue[];
  /** Per game, only when the schema checks passed. */
  checklists: GameChecklist[];
}

const MAX_SCHEMA_ISSUES = 25;

function schemaIssues(label: string, error: z.ZodError): BuildIssue[] {
  const issues: BuildIssue[] = error.issues.slice(0, MAX_SCHEMA_ISSUES).map((i) => ({
    level: 'error',
    message: `${label} schema: ${i.path.join('.') || '(root)'}: ${i.message}`,
  }));
  if (error.issues.length > MAX_SCHEMA_ISSUES)
    issues.push({
      level: 'error',
      message: `${label} schema: … and ${error.issues.length - MAX_SCHEMA_ISSUES} more`,
    });
  return issues;
}

export function validateVersionGroup(
  data: VersionGroupData,
  pokedex: PokedexData,
): ValidationResult {
  const issues: BuildIssue[] = [];
  const error = (message: string) => issues.push({ level: 'error', message });

  const parsedData = versionGroupDataSchema.safeParse(data);
  const parsedPokedex = pokedexDataSchema.safeParse(pokedex);
  if (!parsedData.success) issues.push(...schemaIssues('Data', parsedData.error));
  if (!parsedPokedex.success) issues.push(...schemaIssues('Pokédex', parsedPokedex.error));
  if (!parsedData.success || !parsedPokedex.success) return { issues, checklists: [] };

  const games = new Set<string>(data.games);
  const dexes = new Set(data.species.map((s) => s.dex));
  const groups = new Set(data.exclusiveGroups.map((g) => g.id));
  const unknownGames = (list: Iterable<string>) => [...list].filter((g) => !games.has(g));
  const checkGames = (what: string, list: Iterable<string>) => {
    for (const game of unknownGames(list))
      error(`${what} has game "${game}", which is not in the version group`);
  };
  const checkDex = (what: string, dex: number) => {
    if (!dexes.has(dex)) error(`${what} names #${dex}, which is not in the species list`);
  };

  if (pokedex.versionGroupId !== data.versionGroupId)
    error(
      `Pokédex file is for "${pokedex.versionGroupId}", data file for "${data.versionGroupId}"`,
    );
  for (const game of data.games) {
    if (findGame(game)?.versionGroupId !== data.versionGroupId)
      error(`Game "${game}" is not a registry game of ${data.versionGroupId}`);
  }
  const seen = new Set<string>();
  const itemNumbers = new Set<number>();
  for (const loc of data.locations) {
    if (seen.has(loc.id)) error(`Duplicate location id "${loc.id}"`);
    seen.add(loc.id);
    checkGames(`Location ${loc.id} placement`, Object.keys(loc.placement));
    for (const area of loc.subAreas) {
      for (const e of area.encounters) {
        const what = `#${e.dex} ${e.method} in ${loc.id}/${area.id}`;
        if (!isKnownMethod(e.method)) error(`${what}: unknown method "${e.method}"`);
        checkDex(what, e.dex);
        if (e.trade) checkDex(`${what} trade`, e.trade.giveDex);
        if (e.exclusiveGroupId && !groups.has(e.exclusiveGroupId))
          error(`${what}: unknown exclusive group "${e.exclusiveGroupId}"`);
        checkGames(`${what} slot`, Object.keys(e.games));
      }
    }
    for (const it of loc.items) {
      checkGames(`${it.name} in ${loc.id}`, it.games);
      if (itemNumbers.has(it.no))
        error(`Item number ${it.no} is used twice (${it.name} in ${loc.id})`);
      itemNumbers.add(it.no);
    }
    for (const note of loc.itemNotes)
      if (typeof note !== 'string') checkGames(`Item note in ${loc.id}`, note.games);
  }
  for (const group of data.exclusiveGroups) {
    checkGames(`Exclusive group ${group.id}`, group.games);
    for (const dex of group.members) checkDex(`Exclusive group ${group.id}`, dex);
  }
  for (const dex of data.eventOnly) checkDex('eventOnly', dex);
  for (const dex of data.requiresOtherGame?.flatMap((r) => r.dex) ?? [])
    checkDex('requiresOtherGame', dex);
  for (const edge of data.evolutions) {
    checkDex('Evolution', edge.from);
    checkDex('Evolution', edge.to);
    if (edge.games) checkGames(`Evolution #${edge.from} → #${edge.to}`, edge.games);
  }
  for (const key of Object.keys(pokedex.learnsets)) checkDex('Learnset', Number(key));
  if (data.milestones) issues.push(...checkMilestones(data, pokedex));
  const registryGroup = getVersionGroup(data.versionGroupId as VersionGroupId);
  if ((registryGroup.storyChecklist === true) !== (data.milestones?.length ?? 0) > 0)
    error(
      data.milestones?.length
        ? `The data has milestones, but registry version group ${data.versionGroupId} lacks storyChecklist`
        : `Registry version group ${data.versionGroupId} has storyChecklist, but the data has no milestones`,
    );

  const group = getVersionGroup(data.versionGroupId as VersionGroupId);
  const checklists: GameChecklist[] = [];
  for (const id of data.games) {
    const game = findGame(id);
    if (!game) continue;
    const entries = buildChecklist(data, game, group.features);
    for (const entry of entries) {
      if (entry.unobtainableReason === 'not-in-game') {
        const name = data.species.find((s) => s.dex === entry.dex)?.name ?? '?';
        error(`#${entry.dex} ${name} has no source and no unobtainable reason in ${id}`);
      }
    }
    checklists.push({
      game: id,
      entries,
      maxInOneSave: maxInOneSave(data, game, group.features, entries),
    });
  }
  return { issues, checklists };
}

/**
 * Story milestones against the rest of the data (plan §7.14). Every unlock must be granted by exactly one
 * milestone of its game, no later than the unlock's part (becoming Champion in Part 16 grants the Part 17
 * post-game unlock), so the unlock list and the story list can't drift apart. A grant counts in the milestone's
 * games that have that unlock.
 */
export function checkMilestones(
  data: VersionGroupData,
  pokedex: Pick<PokedexData, 'moves'>,
): BuildIssue[] {
  const issues: BuildIssue[] = [];
  const error = (message: string) => issues.push({ level: 'error', message });
  const milestones = data.milestones ?? [];
  const locations = new Map(data.locations.map((l) => [l.id, l]));
  const dexes = new Set(data.species.map((s) => s.dex));
  const moveTypes = new Map(pokedex.moves.map((m) => [m.name, m.type]));
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const m of milestones) {
    const what = `Milestone "${m.id}"`;
    if (ids.has(m.id)) error(`${what} is listed twice`);
    if (numbers.has(m.no)) error(`Milestone number ${m.no} is used twice ("${m.id}")`);
    ids.add(m.id);
    numbers.add(m.no);
    if ((m.kind === 'gym') !== (m.badge !== undefined))
      error(`${what}: gyms, and only gyms, name a badge`);
    const location = locations.get(m.locationId);
    if (!location) error(`${what}: unknown location "${m.locationId}"`);
    for (const [game, part] of Object.entries(m.part) as [GameId, number][]) {
      if (!data.games.includes(game)) {
        error(`${what} has game "${game}", which is not in the version group`);
        continue;
      }
      if (location && !location.placement[game])
        error(`${what}: location ${m.locationId} is not in ${game}`);
      if (m.after !== undefined) {
        // The journey anchor (plan §13.13) is only for a milestone away from its part's locations.
        const anchor = locations.get(m.after);
        if (location?.placement[game]?.part === part)
          error(`${what}: ${m.locationId} is in part ${part} in ${game}, so it needs no "after"`);
        else if (anchor?.placement[game]?.part !== part)
          error(`${what}: "after" location ${m.after} is not in part ${part} in ${game}`);
      }
      if (!(data.walkthroughs[game] ?? []).some((w) => w.part === part))
        error(`${what}: ${game} has no walkthrough part ${part}`);
      if (
        m.dex !== undefined &&
        location &&
        !location.subAreas.some((a) => a.encounters.some((e) => e.dex === m.dex && e.games[game]))
      )
        error(`${what}: ${m.locationId} has no #${m.dex} encounter in ${game}`);
    }
    // Battle teams (Phase 19): only on battles, only in the milestone's games, with known species and moves.
    if (m.teams && m.kind !== 'gym' && m.kind !== 'battle')
      error(`${what}: only gym and battle milestones have teams`);
    for (const [game, teams] of Object.entries(m.teams ?? {})) {
      if (m.part[game as GameId] === undefined)
        error(`${what} has a team in ${game}, which it isn't in`);
      for (const team of teams ?? []) {
        if (team.variant && !dexes.has(team.variant.dex))
          error(`${what}: ${game} variant #${team.variant.dex} is not in the species list`);
        for (const member of team.pokemon) {
          if (!dexes.has(member.dex))
            error(`${what}: ${game} team has #${member.dex}, which is not in the species list`);
          for (const move of member.moves) {
            const type = moveTypes.get(move.name);
            if (type === undefined)
              error(`${what}: ${game} team move "${move.name}" is not in the Pokédex moves`);
            else if (type !== move.type)
              error(`${what}: ${game} team move "${move.name}" is ${move.type}, not ${type}`);
          }
        }
      }
    }
    // A grant applies in the games that have the unlock (Crystal's Ho-Oh unlock on the all-games Ho-Oh
    // milestone), but it must be an unlock of at least one of them.
    const games = Object.keys(m.part) as GameId[];
    for (const id of m.grants ?? []) {
      if (!games.some((game) => (data.unlocks[game] ?? []).some((u) => u.id === id)))
        error(`${what} grants "${id}", which is not an unlock of any of its games`);
    }
  }
  for (const game of data.games) {
    for (const unlock of data.unlocks[game] ?? []) {
      const granting = milestones.filter(
        (m) => m.part[game] !== undefined && m.grants?.includes(unlock.id),
      );
      if (granting.length !== 1)
        error(
          `${game} unlock "${unlock.id}" is granted by ${granting.length} milestones; it needs exactly one`,
        );
      for (const m of granting) {
        if (m.part[game]! > unlock.part)
          error(
            `${game} unlock "${unlock.id}" is in part ${unlock.part}, but milestone "${m.id}" grants it in part ${m.part[game]}`,
          );
      }
    }
  }
  return issues;
}
