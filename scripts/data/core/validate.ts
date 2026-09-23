/**
 * Output validation (plan §7.8): zod schemas for both data files, cross-reference checks, and obtainability
 * coverage: every species `1..nationalDexMax` must be obtainable or have a reason in every game (plan §9).
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

const slot = z.strictObject({
  levels: levels.nullable(),
  rate,
  conditions: z.array(z.looseObject({ kind: z.string() })).optional(),
  ivs: z.unknown().optional(),
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
  itemNotes: z.array(z.string()),
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
  locations: z.array(location),
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
  }
  for (const group of data.exclusiveGroups) {
    checkGames(`Exclusive group ${group.id}`, group.games);
    for (const dex of group.members) checkDex(`Exclusive group ${group.id}`, dex);
  }
  for (const dex of data.eventOnly) checkDex('eventOnly', dex);
  for (const edge of data.evolutions) {
    checkDex('Evolution', edge.from);
    checkDex('Evolution', edge.to);
    if (edge.games) checkGames(`Evolution #${edge.from} → #${edge.to}`, edge.games);
  }
  for (const key of Object.keys(pokedex.learnsets)) checkDex('Learnset', Number(key));

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
