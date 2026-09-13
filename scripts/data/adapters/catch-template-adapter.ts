/**
 * Row-template adapters: each generation's `catch/entry*` template is read by one adapter, so the walker,
 * merge and validation stay generic (plan §3.2, §7.1).
 */
import type {
  EncounterCondition,
  EncounterMethodId,
  GameId,
  LevelSpec,
  LocationKind,
  Rate,
} from '../../../src/app/core/domain/models';
import { stripMarkup } from '../core/markup';
import type { TemplateCall } from '../core/wikitext';

export interface WalkContext {
  pageTitle: string;
  locationKind: LocationKind;
  /** From the nearest sub-area heading or floor `catch/div`. */
  subArea: string | null;
  /** From the nearest non-floor `catch/div` (e.g. `Fishing`, `Attacking Oak`). */
  divLabel: string | null;
}

export interface RawSlot {
  levels: LevelSpec | null;
  /** Levels column as plain text, for error messages. */
  rawLevels: string;
  rate: Rate;
  conditions?: EncounterCondition[];
  note?: string;
}

export interface RawEncounterRow {
  dex: number;
  name: string;
  /** Method column as plain text: `Grass`, `Fish Super`, `3F`, ... */
  rawMethod: string;
  /** Games whose version column says yes. */
  games: GameId[];
  /** One slot per condition (time-of-day templates produce several). */
  slots: RawSlot[];
  /** Types as written in the row, lowercased. */
  types: string[];
  /** The species the player gives, for `Trade` rows. */
  trade?: { giveDex: number; giveName?: string };
}

export interface NormalizedMethod {
  method: EncounterMethodId;
  /** Overrides the context's sub-area (floor labels in the method column). */
  subArea?: string;
  /** Unlock ids. */
  requires?: string[];
}

export interface CatchTemplateAdapter {
  id: string;
  /** Lowercase template names, matched against normalized names. */
  templateNames: string[];
  /** Games in version-column order. */
  games: GameId[];
  /** Throws `AdapterError` on malformed rows. */
  parseRow(template: TemplateCall, ctx: WalkContext): RawEncounterRow;
  /** Throws `AdapterError` on unknown methods. */
  normalizeMethod(row: RawEncounterRow, ctx: WalkContext): NormalizedMethod;
}

export class AdapterError extends Error {
  override name = 'AdapterError';
}

// ---- helpers shared by adapters ----

export const FLOOR_LABEL = /^B?\d+F$/i;

export function parseDex(raw: string | undefined): number {
  const text = stripMarkup(raw ?? '');
  if (!/^\d{1,4}$/.test(text) || Number(text) === 0) {
    throw new AdapterError(`Invalid National Dex number "${raw ?? ''}"`);
  }
  return Number(text);
}

export function isYes(raw: string | undefined): boolean {
  return /^yes$/i.test((raw ?? '').trim());
}

export function rowTypes(template: TemplateCall): string[] {
  return [template.named['type1'], template.named['type2']]
    .filter((t): t is string => !!t && t.trim() !== '')
    .map((t) => stripMarkup(t).toLowerCase());
}

export function rowTrade(template: TemplateCall): RawEncounterRow['trade'] {
  const give = template.named['tradenum'];
  if (!give) return undefined;
  const giveName = template.named['tradename'];
  return { giveDex: parseDex(give), ...(giveName ? { giveName: stripMarkup(giveName) } : {}) };
}

const BASIC_METHODS: Record<string, NormalizedMethod> = {
  grass: { method: 'walk-grass' },
  cave: { method: 'walk-cave' },
  building: { method: 'walk-building' },
  surf: { method: 'surf', requires: ['surf'] },
  'fish old': { method: 'fish-old', requires: ['old-rod'] },
  'fish good': { method: 'fish-good', requires: ['good-rod'] },
  'fish super': { method: 'fish-super', requires: ['super-rod'] },
  special: { method: 'special' },
  trade: { method: 'trade' },
  // Fossil revival rows (Cinnabar Lab): the method column names the fossil.
  helix: { method: 'fossil' },
  dome: { method: 'fossil' },
  amber: { method: 'fossil' },
};

/**
 * Method columns shared by Gen I and Gen II tables (plan §7.4). Floors (`3F`, `B1F`) become the
 * sub-area and a walking method chosen by location kind; `Gift` with a price becomes `purchase`.
 */
export function normalizeBasicMethod(row: RawEncounterRow, ctx: WalkContext): NormalizedMethod {
  const raw = row.rawMethod.trim();
  if (FLOOR_LABEL.test(raw)) {
    return {
      method: ctx.locationKind === 'cave' ? 'walk-cave' : 'walk-building',
      subArea: raw.toUpperCase(),
    };
  }
  const key = raw.toLowerCase();
  if (key === 'gift') {
    return { method: row.slots.some((s) => s.rate.kind === 'price') ? 'purchase' : 'gift' };
  }
  const known = BASIC_METHODS[key];
  if (!known) throw new AdapterError(`Unknown method "${raw}"`);
  return known.requires ? { ...known, requires: [...known.requires] } : { ...known };
}
