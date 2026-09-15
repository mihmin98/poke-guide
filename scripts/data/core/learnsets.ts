/**
 * Per-generation learnset subpages (`<Name> (Pokémon)/Generation I learnset`). Their rows carry the move's
 * type, power, accuracy and PP as of that generation, which also gives the version group's move list.
 *
 * Kept: "By leveling up", "By TM/HM", "By a prior Evolution".
 * Ignored: transfer-only moves, events, Stadium tutoring, Move Reminder lists.
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
}

export type MoveData = Omit<Move, 'id' | 'machine'>;

export interface ParsedLearnset {
  levelUp: { move: string; levels: Partial<Record<GameId, number>> }[];
  machines: { machine: string; move: string }[];
  prevo: { move: string; fromDex: number[]; games?: GameId[] }[];
  /** Every move seen on the page, by name. */
  moves: MoveData[];
  issues: string[];
}

type Section = 'level' | 'machine' | 'prevo' | 'ignored';

function classifySection(title: string): Section {
  const text = title.toLowerCase();
  if (text === 'by leveling up') return 'level';
  if (text.startsWith('by tm')) return 'machine';
  if (text === 'by a prior evolution') return 'prevo';
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
  const result: ParsedLearnset = { levelUp: [], machines: [], prevo: [], moves: [], issues: [] };
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
  ]);

  /** Reads `name|type|power|accuracy|pp` starting at `index`; returns the move name. */
  const readMove = (call: TemplateCall, index: number): string | null => {
    const [rawName = '', rawType = '', rawPower = '', rawAccuracy = '', rawPp = ''] =
      call.positional.slice(index);
    const name = stripMarkup(rawName);
    const where = `${call.name} "${name}"`;
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
      section = classifySection(headingText(headings[headingIndex]!));
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
      const labels = call.positional.slice(3).map(stripMarkup).filter(Boolean);
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
