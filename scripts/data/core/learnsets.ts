/**
 * Per-generation learnset subpages (`<Name> (Pokémon)/Generation I learnset`). Their rows carry the move's
 * type, power, accuracy and PP as of that generation, which also gives the version group's move list.
 *
 * Kept: "By leveling up", "By TM/HM", "By a prior Evolution", plus "By breeding" (egg moves) where the generation
 * has breeding and "By tutoring" where the version group names its tutor columns (Crystal).
 * Ignored: transfer-only moves, events, Stadium tutoring (Gen I), Move Reminder lists.
 */
import type { GameId, Move } from '../../../src/app/core/domain/models';
import { toRoman } from './generations';
import { stripMarkup } from './markup';
import { headingText } from './sections';
import { slugify } from './slug';
import { toPokemonType } from './species-list';
import { typeExistsIn } from './type-history';
import { findTemplates, parseHeadings, stripComments, type TemplateCall } from './wikitext';

export const learnsetPageTitle = (name: string, generation: number) =>
  `${name} (Pokémon)/Generation ${toRoman(generation)} learnset`;

export interface LearnsetParseOptions {
  generation: number;
  /** Games of the version group; a single level column applies to all of them. */
  games: readonly GameId[];
  /** Level column labels (`{{learnlist/levelh/N|…|RGB|Y}}`) and row game flags (`RB`, `Y`) → games. */
  levelColumns: Readonly<Record<string, readonly GameId[]>>;
  /** Read "By breeding" (Gen II+). */
  eggMoves?: boolean;
  /**
   * Games per trailing game-flag parameter of `{{learnlist/tutorN}}` (Gen II: parameter 8 → Crystal, default `yes`).
   * Absent: "By tutoring" is ignored (Gen I's is the Stadium tutor).
   */
  tutorColumns?: readonly (readonly GameId[])[];
  /** Move data that learnset pages disagree on: used instead of the rows' values, so differing rows aren't issues. */
  moveData?: readonly MoveDataOverride[];
}

export type MoveData = Omit<Move, 'id' | 'machine'>;

/** Corrects the games of an egg move on learnset pages (`config.overrides.eggMovePatches`). */
export interface EggMovePatch {
  /** Species whose pages list the move (a whole evolution family). */
  dex: number[];
  /** Move name as spelled on the pages. */
  move: string;
  /** The games it really is an egg move in; empty drops the move. */
  games: GameId[];
  reason: string;
}

/**
 * Applies egg move patches to parsed learnsets (in place). Returns an error for every species a patch names whose
 * learnset lacks the move.
 */
export function applyEggMovePatches(
  learnsets: readonly (readonly [number, ParsedLearnset])[],
  patches: readonly EggMovePatch[],
  allGames: readonly GameId[],
): string[] {
  const errors: string[] = [];
  for (const patch of patches) {
    for (const dex of patch.dex) {
      const learnset = learnsets.find(([d]) => d === dex)?.[1];
      const row = learnset?.egg.find((r) => r.move === patch.move);
      if (!learnset || !row) {
        errors.push(`Egg move patch: #${dex} has no egg move "${patch.move}"`);
        continue;
      }
      if (patch.games.length === 0) learnset.egg = learnset.egg.filter((r) => r !== row);
      else if (allGames.every((game) => patch.games.includes(game))) delete row.games;
      else row.games = [...patch.games];
    }
  }
  return errors;
}

/** Authoritative data for one move (`config.overrides.moveData`), with a source. */
export interface MoveDataOverride {
  data: MoveData;
  reason: string;
}

export interface ParsedLearnset {
  levelUp: { move: string; levels: Partial<Record<GameId, number>> }[];
  machines: { machine: string; move: string }[];
  prevo: { move: string; fromDex: number[]; games?: GameId[] }[];
  /** Egg moves, by name, without duplicates; `games` from the row's game flag (`GS`, `C`). */
  egg: { move: string; games?: GameId[] }[];
  tutor: { move: string; games?: GameId[] }[];
  /** Every move seen on the page, by name. */
  moves: MoveData[];
  issues: string[];
}

type Section = 'level' | 'machine' | 'prevo' | 'egg' | 'tutor' | 'ignored';

function classifySection(title: string, options: LearnsetParseOptions): Section {
  const text = title.toLowerCase();
  if (text === 'by leveling up') return 'level';
  if (text.startsWith('by tm')) return 'machine';
  if (text === 'by a prior evolution') return 'prevo';
  if (text === 'by breeding' && options.eggMoves) return 'egg';
  if (text === 'by tutoring' && options.tutorColumns) return 'tutor';
  return 'ignored';
}

function optionalNumber(raw: string): number | null | undefined {
  const text = stripMarkup(raw);
  if (text === '—' || text === '-' || text === '') return null;
  const value = Number(text);
  return Number.isInteger(value) ? value : undefined;
}

export function parseLearnsetPage(wikitext: string, options: LearnsetParseOptions): ParsedLearnset {
  const text = stripComments(wikitext);
  const gen = options.generation;
  const roman = toRoman(gen).toLowerCase();
  const result: ParsedLearnset = {
    levelUp: [],
    machines: [],
    prevo: [],
    egg: [],
    tutor: [],
    moves: [],
    issues: [],
  };
  const moves = new Map<string, MoveData>();

  const ignoredTemplates = new Set([
    'learnlist/levelf',
    'learnlist/tmh',
    'learnlist/tmf',
    `learnlist/tm${gen}null`,
    'learnlist/alltm',
    'learnlist/prevoh',
    'learnlist/prevof',
    `learnlist/prevo${gen}null`,
    'learnlist/breedh',
    'learnlist/breedf',
    `learnlist/breed${gen}null`,
    'learnlist/tutorh',
    'learnlist/tutorf',
    `learnlist/tutor${gen}null`,
  ]);

  /** Reads `name|type|power|accuracy|pp` starting at `index`; returns the move name. */
  const readMove = (call: TemplateCall, index: number): string | null => {
    const [rawName = '', rawType = '', rawPower = '', rawAccuracy = '', rawPp = ''] =
      call.positional.slice(index);
    const name = stripMarkup(rawName);
    const where = `${call.name} "${name}"`;
    const override = options.moveData?.find((m) => m.data.name === name);
    if (override) {
      moves.set(name, { ...override.data });
      return name;
    }
    let type;
    try {
      type = toPokemonType(rawType);
    } catch {
      result.issues.push(`${where}: unknown type "${rawType}"`);
      return null;
    }
    if (!typeExistsIn(type, gen))
      result.issues.push(`${where}: type ${type} doesn't exist in Generation ${toRoman(gen)}`);
    const power = optionalNumber(rawPower);
    const accuracy = optionalNumber(rawAccuracy);
    const pp = optionalNumber(rawPp);
    if (!name || power === undefined || accuracy === undefined || typeof pp !== 'number') {
      result.issues.push(
        `${where}: malformed move data "${call.positional.slice(index, index + 5).join('|')}"`,
      );
      return null;
    }
    const data: MoveData = { name, type, power, accuracy, pp };
    const known = moves.get(name);
    if (!known) moves.set(name, data);
    else if (JSON.stringify(known) !== JSON.stringify(data))
      result.issues.push(`${where}: conflicting move data on the page`);
    return name;
  };

  const headings = parseHeadings(text);
  let section: Section = 'ignored';
  let columns: (readonly GameId[])[] = [options.games];
  let headingIndex = 0;

  for (const call of findTemplates(text)) {
    while (headingIndex < headings.length && headings[headingIndex]!.start < call.start) {
      section = classifySection(headingText(headings[headingIndex]!), options);
      headingIndex++;
    }
    if (
      section === 'ignored' ||
      !call.name.startsWith('learnlist/') ||
      ignoredTemplates.has(call.name)
    )
      continue;

    if (section === 'level' && call.name === 'learnlist/levelh') {
      columns = [options.games];
    } else if (section === 'level' && call.name === `learnlist/levelh/${gen}`) {
      // Gen II headers put a number before the labels (`levelh/2|Magneton|Electric|Steel|1|GS|C`).
      const labels = call.positional
        .slice(3)
        .map(stripMarkup)
        .filter((label) => label && !/^\d+$/.test(label));
      const mapped = labels.map((label) => options.levelColumns[label]);
      if (labels.length === 0 || mapped.some((games) => !games)) {
        result.issues.push(`${call.name}: unknown level columns "${labels.join('|')}"`);
        columns = [];
      } else {
        columns = mapped as (readonly GameId[])[];
      }
    } else if (
      section === 'level' &&
      (call.name === `learnlist/level${gen}` || call.name === `learnlist/level${roman}`)
    ) {
      const width = call.name === `learnlist/level${gen}` ? 1 : columns.length;
      if (width !== columns.length) {
        result.issues.push(
          `${call.name}: ${width} level column(s) under a header with ${columns.length}`,
        );
        continue;
      }
      const move = readMove(call, width);
      if (!move) continue;
      const levels: Partial<Record<GameId, number>> = {};
      call.positional.slice(0, width).forEach((raw, i) => {
        const token = stripMarkup(raw);
        if (token === 'N/A') return;
        // `42*` carries a footnote marker (Yellow can't learn two moves at one level).
        const match = /^(\d+)\*?$/.exec(token);
        if (!match) {
          result.issues.push(`${call.name} "${move}": unparseable level "${token}"`);
          return;
        }
        for (const game of columns[i]!) levels[game] = Number(match[1]);
      });
      if (Object.keys(levels).length > 0) result.levelUp.push({ move, levels });
    } else if (section === 'machine' && call.name === `learnlist/tm${gen}`) {
      const machine = stripMarkup(call.positional[0] ?? '');
      const move = readMove(call, 1);
      if (!/^(TM|HM)\d{2,3}$/.test(machine))
        result.issues.push(`${call.name}: unexpected machine "${machine}"`);
      else if (move) result.machines.push({ machine, move });
    } else if (section === 'prevo' && call.name === `learnlist/prevo${gen}`) {
      // `prevo1|029|Nidoran♀||030|Nidorina||Double Kick|Fighting|30|100|30||RB`: up to two previous stages
      // (dex, name, marker), the move from parameter 7, then an optional bold marker and game flag.
      const rawDex = [call.positional[0], call.positional[3]].filter(
        (value): value is string => !!value,
      );
      const fromDex = rawDex.map(Number);
      const flag = stripMarkup(call.positional[12] ?? '');
      const games = flag ? options.levelColumns[flag] : undefined;
      const move = readMove(call, 6);
      if (fromDex.length === 0 || fromDex.some((dex) => !Number.isInteger(dex))) {
        result.issues.push(`${call.name}: bad Pokédex numbers "${rawDex.join('|')}"`);
      } else if (flag && !games) {
        result.issues.push(`${call.name} "${move}": unknown game flag "${flag}"`);
      } else if (move) {
        result.prevo.push(games ? { move, fromDex, games: [...games] } : { move, fromDex });
      }
    } else if (section === 'egg' && call.name === `learnlist/breed${gen}`) {
      // `breed2|<parents as MSP icons>|AncientPower|Rock|60|100|5|*||GS`: a move can repeat with other parents;
      // parameter 9 is an optional game flag.
      const move = readMove(call, 1);
      const flag = stripMarkup(call.positional[8] ?? '');
      const games = flag ? options.levelColumns[flag] : undefined;
      if (flag && !games) result.issues.push(`${call.name} "${move}": unknown game flag "${flag}"`);
      else if (move) {
        const known = result.egg.find((row) => row.move === move);
        if (!known) result.egg.push(games ? { move, games: [...games] } : { move });
        else if (JSON.stringify(known.games) !== JSON.stringify(games))
          result.issues.push(`${call.name} "${move}": listed for different games`);
      }
    } else if (section === 'tutor' && call.name === `learnlist/tutor${gen}`) {
      // `tutor2|Flamethrower|Fire|95|100|15||'''|yes`: the move, two formatting markers, then one flag per column.
      const move = readMove(call, 0);
      const columns = options.tutorColumns ?? [];
      const games = columns.flatMap((column, i) =>
        /^no$/i.test(stripMarkup(call.positional[7 + i] ?? 'yes')) ? [] : column,
      );
      const all = options.games.every((game) => games.includes(game));
      if (move && games.length)
        result.tutor.push(all ? { move } : { move, games: [...new Set(games)] });
    } else {
      result.issues.push(`Unexpected template {{${call.name}}} in a "${section}" section`);
    }
  }
  result.moves = [...moves.values()];
  return result;
}

/**
 * Merges the moves of every learnset into the version group's move list (ids are slugs of the generation's
 * spelling). Different data for one move, or two machines teaching one move, are issues.
 */
export function collectMoves(learnsets: readonly ParsedLearnset[]): {
  moves: Move[];
  issues: string[];
} {
  const byId = new Map<string, Move>();
  const issues: string[] = [];
  for (const learnset of learnsets) {
    for (const data of learnset.moves) {
      const id = slugify(data.name);
      const known = byId.get(id);
      if (!known) byId.set(id, { id, ...data });
      else if (
        known.name !== data.name ||
        known.type !== data.type ||
        known.power !== data.power ||
        known.accuracy !== data.accuracy ||
        known.pp !== data.pp
      ) {
        issues.push(`Move "${data.name}" has conflicting data across learnsets`);
      }
    }
    for (const { machine, move } of learnset.machines) {
      const known = byId.get(slugify(move));
      if (!known) continue;
      if (known.machine && known.machine !== machine)
        issues.push(`Move "${move}" is taught by ${known.machine} and ${machine}`);
      known.machine = machine;
    }
  }
  const moves = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  const machineOwners = new Map<string, string>();
  for (const move of moves) {
    if (!move.machine) continue;
    const owner = machineOwners.get(move.machine);
    if (owner) issues.push(`${move.machine} teaches both ${owner} and ${move.name}`);
    machineOwners.set(move.machine, move.name);
  }
  return { moves, issues };
}
