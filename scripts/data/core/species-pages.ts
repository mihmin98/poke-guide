/**
 * Species pages (`<Name> (Pokémon)`, plan §7.11): infobox fields, base stats with generation ranges,
 * and Pokédex entries per generation.
 */
import type {
  GameId,
  GrowthRate,
  PokedexEntryText,
  StatId,
} from '../../../src/app/core/domain/models';
import { parseGenerationRange, toRoman, type GenerationRange } from './generations';
import { stripMarkup } from './markup';
import { findNestedSection, headingText, headingsWithin } from './sections';
import {
  findTemplates,
  parseHeadings,
  stripComments,
  type Heading,
  type TemplateCall,
} from './wikitext';

export const speciesPageTitle = (name: string) => `${name} (Pokémon)`;

export interface InfoboxData {
  dex: number;
  name: string;
  /**
   * Current category, without " Pokémon". Older all-caps spellings ("POISONMOTH" before Generation III)
   * are deliberately not used: the current spelling reads better and names the same thing.
   */
  category: string;
  heightM: number;
  weightKg: number;
  /** Current base experience yield (`expyield`). */
  baseExp: number;
  /** Generation I–IV base experience yield (`oldexp`). */
  oldBaseExp: number | null;
  growthRate: GrowthRate;
  /** Current catch rate; older values come from the catch-rate history. */
  catchRate: number;
  /** Current effort value yield. */
  evYield: Partial<Record<StatId, number>>;
  eggGroups: string[];
  /** `gendercode`: female ratio in 254ths, 255 for genderless. */
  genderCode: number | null;
}

/** Experience needed for level 100 → growth rate (Bulbapedia "Experience"). */
const GROWTH_BY_LV100_EXP: Record<number, GrowthRate> = {
  600000: 'erratic',
  800000: 'fast',
  1000000: 'medium-fast',
  1059860: 'medium-slow',
  1250000: 'slow',
  1640000: 'fluctuating',
};

const EV_KEYS: Record<string, StatId> = {
  evhp: 'hp',
  evat: 'atk',
  evde: 'def',
  evsa: 'spa',
  evsd: 'spd',
  evsp: 'spe',
};

function findInfobox(text: string): TemplateCall {
  const infobox = findTemplates(text).find((t) => t.name === 'pokémon infobox');
  if (!infobox) throw new Error('No {{Pokémon Infobox}}');
  return infobox;
}

/**
 * Reads a numeric field, ignoring a trailing note such as `218 (214 in V-VI)` (Raichu's `expyield`) or a footnote
 * marker, `1{{tt|*|2 in Generation III}}` (Yanma's `evsp`).
 */
function numberField(call: TemplateCall, key: string): number {
  const raw = stripMarkup(call.named[key] ?? '')
    .replace(/\s*\([^)]*\)$/, '')
    .replace(/\*$/, '')
    .replace(/,/g, '');
  const value = Number(raw);
  if (raw === '' || !Number.isFinite(value))
    throw new Error(`Infobox field "${key}" is not a number: "${raw}"`);
  return value;
}

export function parseInfobox(wikitext: string): InfoboxData {
  const infobox = findInfobox(stripComments(wikitext));
  const growth = GROWTH_BY_LV100_EXP[numberField(infobox, 'lv100exp')];
  if (!growth) throw new Error(`Unknown growth rate for lv100exp=${infobox.named['lv100exp']}`);
  // Pages with regional forms list one category per line; the first is the original form.
  const category = stripMarkup(
    (infobox.named['category'] ?? '').split(/<br\s*\/?>/i)[0] ?? '',
  ).replace(/\s+Pokémon$/, '');
  if (!category) throw new Error('Infobox has no category');
  const evYield: Partial<Record<StatId, number>> = {};
  for (const [key, stat] of Object.entries(EV_KEYS)) {
    if (infobox.named[key]) evYield[stat] = numberField(infobox, key);
  }
  return {
    dex: numberField(infobox, 'ndex'),
    name: stripMarkup(infobox.named['name'] ?? ''),
    category,
    heightM: numberField(infobox, 'height-m'),
    weightKg: numberField(infobox, 'weight-kg'),
    baseExp: numberField(infobox, 'expyield'),
    oldBaseExp: infobox.named['oldexp'] ? numberField(infobox, 'oldexp') : null,
    growthRate: growth,
    catchRate: numberField(infobox, 'catchrate'),
    evYield,
    eggGroups: ['egggroup1', 'egggroup2']
      .map((key) => stripMarkup(infobox.named[key] ?? ''))
      .filter((group) => group !== ''),
    genderCode: infobox.named['gendercode'] ? numberField(infobox, 'gendercode') : null,
  };
}

/**
 * `gendercode` → the female fraction the app works with (`Species.genderRatio`), or `'genderless'`.
 * The codes are the games' byte thresholds (31 = 12.5 % female), so they map through a table rather than
 * dividing; an unknown code returns `undefined` and fails the build.
 */
const GENDER_RATIOS: Record<number, number | 'genderless'> = {
  0: 0,
  31: 0.125,
  63: 0.25,
  127: 0.5,
  191: 0.75,
  225: 0.875,
  254: 1,
  255: 'genderless',
};

export function genderRatioFromCode(code: number): number | 'genderless' | undefined {
  return GENDER_RATIOS[code];
}

/** Base experience yields were rebalanced in Generation V; `oldexp` holds the Generation I–IV value. */
export function baseExpIn(info: InfoboxData, generation: number): number {
  return generation <= 4 && info.oldBaseExp !== null ? info.oldBaseExp : info.baseExp;
}

// ---- base stats ----

export interface BaseStatsBlock extends GenerationRange {
  stats: Partial<Record<StatId, number>>;
}

/** `{{Stats}}` on most pages; `{{BaseStats with RBY}}` (Ditto, Mew) and `{{Base Stats}}` on a few. */
const STATS_TEMPLATES = new Set(['stats', 'base stats', 'basestats', 'basestats with rby']);

const STAT_KEYS: Record<string, StatId> = {
  HP: 'hp',
  Attack: 'atk',
  Defense: 'def',
  SpAtk: 'spa',
  SpDef: 'spd',
  Speed: 'spe',
  Special: 'spc',
};

/**
 * Every stats template under `Stats` → `Base stats`, with the generation range of its nearest range heading.
 * Blocks under other headings (Mega Evolutions, regional forms, Partner Pikachu) are skipped; a heading
 * equal to the species name is the default form.
 */
export function parseBaseStats(wikitext: string, speciesName: string): BaseStatsBlock[] {
  const text = stripComments(wikitext);
  const headings = parseHeadings(text);
  const section = findNestedSection(text, ['Stats', 'Base stats'], headings);
  if (!section) throw new Error('No "Stats → Base stats" section');
  const inner = headingsWithin(headings, section);
  const blocks: BaseStatsBlock[] = [];
  for (const call of findTemplates(text, section.start, section.end)) {
    if (!STATS_TEMPLATES.has(call.name)) continue;
    const chain: Heading[] = [];
    for (const heading of inner) {
      if (heading.start > call.start) break;
      while (chain.length > 0 && chain.at(-1)!.level >= heading.level) chain.pop();
      chain.push(heading);
    }
    let range: GenerationRange = { from: 1, to: Infinity };
    let defaultForm = true;
    for (const heading of chain) {
      const title = headingText(heading);
      const parsed = parseGenerationRange(title);
      if (parsed) range = parsed;
      else if (title.toLowerCase() !== speciesName.toLowerCase()) defaultForm = false;
    }
    if (!defaultForm) continue;
    const stats: Partial<Record<StatId, number>> = {};
    for (const [key, stat] of Object.entries(STAT_KEYS)) {
      const raw = call.named[key];
      if (raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (!Number.isInteger(value)) throw new Error(`Base stat ${key} is not a number: "${raw}"`);
      stats[stat] = value;
    }
    blocks.push({ ...range, stats });
  }
  return blocks;
}

const GEN1_STATS: StatId[] = ['hp', 'atk', 'def', 'spc', 'spe'];
const MODERN_STATS: StatId[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Gen I: hp/atk/def/spc/spe · Gen II+: hp/atk/def/spa/spd/spe. Throws if no single block covers the generation. */
export function baseStatsIn(
  blocks: readonly BaseStatsBlock[],
  generation: number,
): Partial<Record<StatId, number>> {
  const matching = blocks.filter((b) => b.from <= generation && generation <= b.to);
  if (matching.length !== 1) {
    throw new Error(`${matching.length} base stat blocks cover Generation ${toRoman(generation)}`);
  }
  const stats: Partial<Record<StatId, number>> = {};
  for (const stat of generation === 1 ? GEN1_STATS : MODERN_STATS) {
    const value = matching[0]!.stats[stat];
    if (value === undefined)
      throw new Error(`Missing base stat "${stat}" for Generation ${toRoman(generation)}`);
    stats[stat] = value;
  }
  return stats;
}

// ---- Pokédex entries ----

export interface RawPokedexEntry {
  /** Version names as written (`Red`, `Blue`, `Stadium`). */
  versions: string[];
  text: string;
}

/** `{{Dex/Entry1|v=Yellow|entry=…}}` / `{{Dex/Entry2|v=Red|v2=Blue|entry=…}}` inside the `{{Dex/Gen/N|gen=<roman>}}` block. */
export function parsePokedexEntries(wikitext: string, generation: number): RawPokedexEntry[] {
  const roman = toRoman(generation);
  const entries: RawPokedexEntry[] = [];
  let inGeneration = false;
  for (const call of findTemplates(stripComments(wikitext))) {
    if (call.name.startsWith('dex/gen/')) {
      inGeneration = stripMarkup(call.named['gen'] ?? '') === roman;
      continue;
    }
    if (!inGeneration || !/^dex\/entry\d+$/.test(call.name)) continue;
    const versions = Object.keys(call.named)
      .filter((key) => /^v\d*$/.test(key))
      .sort((a, b) => Number(a.slice(1) || 1) - Number(b.slice(1) || 1))
      .map((key) => stripMarkup(call.named[key]!));
    entries.push({ versions, text: stripMarkup(call.named['entry'] ?? '') });
  }
  return entries;
}

/** Maps version names to games by `shortName`; entries for versions outside the list (Stadium) are dropped. */
export function pokedexEntriesForGames(
  entries: readonly RawPokedexEntry[],
  games: readonly { id: GameId; shortName: string }[],
): PokedexEntryText[] {
  return entries.flatMap((entry) => {
    const ids = games.filter((g) => entry.versions.includes(g.shortName)).map((g) => g.id);
    return ids.length > 0 ? [{ games: ids, text: entry.text }] : [];
  });
}
