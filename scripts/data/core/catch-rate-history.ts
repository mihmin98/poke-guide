/**
 * Catch-rate history from `List of Pokémon by catch rate` (plan §7.11).
 *
 * Each row holds the current catch rate plus free-text notes. Notes are sorted into three effects:
 * - an earlier value (`90 prior to Generation III`, `5 prior to ORAS`), applied automatically;
 * - a value for games outside the version group (`90 in XD: Gale of Darkness`), ignored;
 * - anything else, including notes naming one of the version group's games (`27 in Pokémon Yellow`),
 *   which must be classified in `version-groups/<id>/overrides/catch-rate-notes.ts`. Unclassified notes
 *   are build errors, so new edge cases can't slip in silently.
 */
import type { GameId } from '../../../src/app/core/domain/models';
import { GAMES } from '../../../src/app/core/games/registry';
import { fromRoman } from './generations';
import { replaceTemplates, stripMarkup } from './markup';
import { findNestedSection } from './sections';
import { splitTopLevel, stripComments } from './wikitext';

export const CATCH_RATE_LIST_PAGE = 'List of Pokémon by catch rate';

export interface CatchRateRow {
  dex: number;
  name: string;
  /** Plain-text form label (`Partner`, `Meteor Form`); `null` for the default row. */
  form: string | null;
  /** Current catch rate. */
  catchRate: number;
  /** Plain-text notes, one per `<br>`-separated line. */
  notes: string[];
}

// ---- parsing ----

/** Drops a leading `attr="…" |` from a table cell. */
function cellContent(cell: string): string {
  const parts = splitTopLevel(cell, '|');
  return parts.length === 2 && /^\s*[a-z-]+\s*=/i.test(parts[0]!) ? parts[1]!.trim() : cell.trim();
}

const FORM_TEMPLATES = new Set(['fd', 'form']);

/** `{{p|Pikachu}}<br><small>{{OBP|…|Partner}}</small>`, also with the `<small>` line first (Bloodmoon Ursaluna). */
function parseNameCell(cell: string): { name: string; form: string | null } {
  let name = '';
  let form: string | null = null;
  for (const part of cell.split(/<br\s*\/?>/i)) {
    if (/<small>/i.test(part)) {
      // `{{fd|Minior|Meteor Form}}` and `{{form|Ursaluna|Bloodmoon}}` show their last argument.
      const shown = replaceTemplates(part, (call) =>
        FORM_TEMPLATES.has(call.name)
          ? (call.positional.at(-1) ?? '')
          : part.slice(call.start, call.end),
      );
      form = stripMarkup(shown).replace(/^\((.*)\)$/, '$1');
    } else name = stripMarkup(part);
  }
  return { name, form };
}

/** Rows of the `List of Pokémon` table. The Legends: Arceus table in the next section is not read. */
export function parseCatchRateList(wikitext: string): CatchRateRow[] {
  const text = stripComments(wikitext);
  const section = findNestedSection(text, ['List of Pokémon']);
  if (!section) throw new Error('No "List of Pokémon" section');
  const rows: CatchRateRow[] = [];
  for (const chunk of text.slice(section.start, section.end).split(/\n\|-[^\n]*/)) {
    const cells = chunk
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.startsWith('|}'))
      .flatMap((line) => line.slice(1).split('||'))
      .map(cellContent);
    if (!/^\d{1,4}$/.test(cells[0] ?? '')) continue;
    const [rawDex, , nameCell = '', rawRate = '', noteCell = '', ...extra] = cells;
    const dex = Number(rawDex);
    const { name, form } = parseNameCell(nameCell);
    const catchRate = Number(stripMarkup(rawRate));
    if (
      !name ||
      extra.length > 0 ||
      !Number.isInteger(catchRate) ||
      catchRate < 0 ||
      catchRate > 255
    ) {
      throw new Error(`Malformed catch-rate row: ${chunk.trim()}`);
    }
    const previous = rows.at(-1);
    if (previous && dex < previous.dex)
      throw new Error(`Catch-rate list is out of order at #${dex}`);
    const notes = noteCell
      .split(/<br\s*\/?>/i)
      .map(stripMarkup)
      .filter((note) => note !== '');
    rows.push({ dex, name, form, catchRate, notes });
  }
  return rows;
}

// ---- note effects ----

/** Games named in notes that are not in the registry, with their generation. */
const OTHER_GAME_GENERATIONS: Readonly<Record<string, number>> = {
  Colosseum: 3,
  'Colosseum: Japanese e-Room exclusive': 3,
  'XD: Gale of Darkness': 3,
  ORAS: 6,
  USUM: 7,
  "Let's Go Pikachu and Eevee": 7,
  SwSh: 8,
  BDSP: 8,
  SV: 9,
  'SV 2.0.1': 9,
  'Legends: Z-A': 9,
};

interface NoteGame {
  label: string;
  generation: number;
  /** Set for registry games. */
  id?: GameId;
}

function resolveGame(label: string): NoteGame | null {
  const game = GAMES.find((g) => g.name === label || g.shortName === label);
  if (game) return { label, generation: game.generation, id: game.id };
  const generation = OTHER_GAME_GENERATIONS[label];
  return generation === undefined ? null : { label, generation };
}

/** `XD: Gale of Darkness`, `USUM and SwSh`, `ORAS, USUM, SwSh, BDSP, and Legends: Z-A`. `null` if any name is unknown. */
function resolveGameList(text: string): NoteGame[] | null {
  const whole = resolveGame(text);
  if (whole) return [whole];
  const games = text.split(/,\s*(?:and\s+)?|\s+and\s+/).map(resolveGame);
  return games.every((g) => g !== null) ? games : null;
}

export interface CatchRateContext {
  generation: number;
  games: readonly GameId[];
}

export type CatchRateNoteEffect =
  /** `value` is the catch rate before `untilGeneration` (`label` names where it changed). */
  | { kind: 'earlier-value'; value: number; untilGeneration: number; label: string }
  /** Only concerns games outside the version group. */
  | { kind: 'other-games' }
  | { kind: 'needs-classification' };

const PRIOR_TO_GENERATION = /^(\d+) prior to Generation ([IVX]+)$/;
const PRIOR_TO_GAME = /^(\d+) prior to (.+)$/;
const IN_GAMES = /^(?:\d+|Always succeeds?) in (.+)$/;

export function catchRateNoteEffect(note: string, context: CatchRateContext): CatchRateNoteEffect {
  const needs = { kind: 'needs-classification' } as const;
  const priorGeneration = PRIOR_TO_GENERATION.exec(note);
  if (priorGeneration) {
    const generation = fromRoman(priorGeneration[2]!);
    if (generation === null) return needs;
    const label = `Generation ${priorGeneration[2]}`;
    return {
      kind: 'earlier-value',
      value: Number(priorGeneration[1]),
      untilGeneration: generation,
      label,
    };
  }
  const priorGame = PRIOR_TO_GAME.exec(note);
  if (priorGame) {
    const game = resolveGame(priorGame[2]!);
    // Within the game's own generation it is unclear which games the earlier value covers.
    if (!game || game.generation === context.generation) return needs;
    return {
      kind: 'earlier-value',
      value: Number(priorGame[1]),
      untilGeneration: game.generation,
      label: game.label,
    };
  }
  const inGames = IN_GAMES.exec(note);
  if (inGames) {
    const games = resolveGameList(inGames[1]!);
    if (games && games.every((g) => g.id === undefined || !context.games.includes(g.id))) {
      return { kind: 'other-games' };
    }
  }
  return needs;
}

// ---- resolution ----

export type CatchRateNoteClassification = {
  dex: number;
  /** The note exactly as parsed (plain text). */
  note: string;
  /** Text for `species[].catchRateNote`; omit to show nothing. */
  display?: string;
  /** Why this classification is right, with a source. */
  reason: string;
} & (
  | /** Informational only: the catch rate used for capture is unchanged. */ { kind: 'note-only' }
  | /** `value` is the catch rate used for capture in `games`, or in every game of the version group. */ {
      kind: 'override';
      value: number;
      games?: GameId[];
    }
);

export interface ResolvedCatchRate {
  catchRate: number;
  /** Games whose capture uses a different value (Yellow Dragonair: 27). */
  catchRateByGame?: Partial<Record<GameId, number>>;
  note?: string;
}

export interface CatchRateResolution {
  rates: Map<number, ResolvedCatchRate>;
  errors: string[];
}

/**
 * Catch rate per species in `speciesRange` for the version group's generation. Only default-form rows are used.
 * Errors: a species without exactly one default row, unclassified notes, and classifications that match no note.
 */
export function resolveCatchRates(
  rows: readonly CatchRateRow[],
  context: CatchRateContext & {
    speciesRange: [number, number];
    classifications: readonly CatchRateNoteClassification[];
  },
): CatchRateResolution {
  const rates = new Map<number, ResolvedCatchRate>();
  const errors: string[] = [];
  const used = new Set<CatchRateNoteClassification>();
  const [from, to] = context.speciesRange;
  for (let dex = from; dex <= to; dex++) {
    const defaults = rows.filter((r) => r.dex === dex && r.form === null);
    if (defaults.length !== 1) {
      errors.push(`#${dex}: ${defaults.length} default rows in the catch-rate list`);
      continue;
    }
    const row = defaults[0]!;
    let catchRate = row.catchRate;
    const notes: string[] = [];
    const earlier: Extract<CatchRateNoteEffect, { kind: 'earlier-value' }>[] = [];
    let override: number | null = null;
    let byGame: Partial<Record<GameId, number>> | null = null;
    for (const note of row.notes) {
      const effect = catchRateNoteEffect(note, context);
      if (effect.kind === 'earlier-value') earlier.push(effect);
      if (effect.kind !== 'needs-classification') continue;
      const classification = context.classifications.find((c) => c.dex === dex && c.note === note);
      if (!classification) {
        errors.push(`#${dex} ${row.name}: unclassified catch-rate note "${note}"`);
        continue;
      }
      used.add(classification);
      if (classification.kind === 'override' && classification.games) {
        const outside = classification.games.filter((g) => !context.games.includes(g));
        if (outside.length > 0) {
          errors.push(
            `#${dex} ${row.name}: catch-rate override names games outside the version group: ${outside.join(', ')}`,
          );
        }
        byGame ??= {};
        for (const game of classification.games) byGame[game] = classification.value;
      } else if (classification.kind === 'override') {
        override = classification.value;
      }
      if (classification.display) notes.push(classification.display);
    }
    // The value for this generation comes from the first change after it; the note names the next value.
    earlier.sort((a, b) => a.untilGeneration - b.untilGeneration);
    const index = earlier.findIndex((e) => e.untilGeneration > context.generation);
    if (index !== -1) {
      const change = earlier[index]!;
      catchRate = change.value;
      notes.unshift(`${earlier[index + 1]?.value ?? row.catchRate} from ${change.label}`);
    }
    if (override !== null) catchRate = override;
    const resolved: ResolvedCatchRate = { catchRate };
    if (byGame) resolved.catchRateByGame = byGame;
    if (notes.length > 0) resolved.note = notes.join('; ');
    rates.set(dex, resolved);
  }
  for (const classification of context.classifications) {
    if (!used.has(classification)) {
      errors.push(
        `#${classification.dex}: catch-rate note classification matches no note: "${classification.note}"`,
      );
    }
  }
  return { rates, errors };
}
