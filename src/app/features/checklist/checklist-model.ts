// Pure view model for the checklist page (plan §13.6): no Angular, so it can be unit-tested on its own.
import { evolutionDetailText } from '../../shared/evolution-text';
import type { GameView } from '../../core/domain/game-view';
import type { GameId, PokemonType } from '../../core/domain/models';
import type { ChecklistEntry, ObtainSource, UnobtainableReason } from '../../core/domain/obtainability';
import { findMethod, type EncounterMethodCategory } from '../../core/games/methods';

/**
 * How a species can be obtained, as the filter chips show it (plan §13.6). Wild, surfing and fishing
 * encounters collapse into `wild`; evolution and breeding are the two non-encounter source kinds.
 */
export type ObtainCategory =
  | 'wild'
  | 'evolution'
  | 'breeding'
  | Exclude<EncounterMethodCategory, 'wild' | 'water' | 'fishing' | 'egg'>;

const CATEGORY_ORDER: readonly ObtainCategory[] = [
  'wild',
  'evolution',
  'breeding',
  'gift',
  'trade',
  'prize',
  'static',
  'fossil',
];

const CATEGORY_LABELS: Record<ObtainCategory, string> = {
  wild: 'Wild',
  evolution: 'Evolve',
  breeding: 'Breed',
  gift: 'Gift',
  trade: 'Trade',
  prize: 'Prize',
  static: 'Static',
  fossil: 'Fossil',
};

export function obtainCategoryLabel(category: ObtainCategory): string {
  return CATEGORY_LABELS[category];
}

/** The category of one source, or `undefined` for an encounter whose method is not in the registry. */
export function categoryOf(source: ObtainSource): ObtainCategory | undefined {
  if (source.kind === 'evolution') return 'evolution';
  if (source.kind === 'breeding') return 'breeding';
  const method = source.method ? findMethod(source.method) : undefined;
  if (!method) return undefined;
  switch (method.category) {
    case 'wild':
    case 'water':
    case 'fishing':
      return 'wild';
    case 'egg':
      return 'breeding';
    default:
      return method.category;
  }
}

const REASON_LABELS: Record<UnobtainableReason, string> = {
  'other-version': 'Version exclusive',
  'trade-evolution': 'Evolves only by trading',
  'event-only': 'Event distribution only',
  'requires-other-game': 'Needs another game',
  'not-in-game': 'Not in this game',
};

export function unobtainableLabel(reason: UnobtainableReason): string {
  return REASON_LABELS[reason];
}

/** One source, with its names resolved for display. */
export interface ChecklistSource {
  category: ObtainCategory | undefined;
  /** "Route 24", "Evolves from Abra", "Breed Nidoran♀". */
  label: string;
  /** Method or trigger detail: "Grass", "Lv 16", "Trade — Mr. Mime for Abra". */
  detail?: string;
  locationId?: string;
  part: number;
}

export interface ChecklistRow {
  dex: number;
  name: string;
  slug: string;
  types: readonly PokemonType[];
  caught: boolean;
  obtainable: boolean;
  regionalDex?: number;
  categories: ObtainCategory[];
  sources: ChecklistSource[];
  /** The source you can reach first, for the list view and the walkthrough sort. */
  earliest?: ChecklistSource;
  exclusiveGroupLabels: string[];
  unobtainableReason?: UnobtainableReason;
  unobtainableDetail?: string;
}

export type ChecklistStatus = 'all' | 'missing' | 'caught';
export type ChecklistSort = 'national' | 'regional' | 'walkthrough';

export interface ChecklistFilters {
  status: ChecklistStatus;
  /** Matches the name, the slug and `#025` / `25`. */
  search: string;
  /** Empty means every type. */
  types: ReadonlySet<PokemonType>;
  /** Empty means every category. */
  categories: ReadonlySet<ObtainCategory>;
  /** Needs `progressPart`: keeps only species with a source up to that part. */
  onlyAvailable: boolean;
  sort: ChecklistSort;
}

export interface ChecklistInput {
  view: GameView;
  game: GameId;
  entries: readonly ChecklistEntry[];
  caught: ReadonlySet<number>;
  progressPart?: number;
  /** From `maxInOneSave` (plan §9); shown in the summary. */
  maxInOneSave?: number;
  filters: ChecklistFilters;
}

export interface TypeProgress {
  type: PokemonType;
  caught: number;
  total: number;
}

export interface ChecklistSummary {
  /** Caught species that are obtainable without trading. */
  caught: number;
  obtainable: number;
  /** Caught species that are not obtainable here (imported from another save). */
  caughtExtra: number;
  maxInOneSave: number | undefined;
  byType: TypeProgress[];
}

export interface ChecklistView {
  rows: ChecklistRow[];
  /** Species with no source in this game, whatever the filters say (plan §13.6). */
  unobtainable: ChecklistRow[];
  /** Categories that at least one species in this game actually has, in chip order. */
  categories: ObtainCategory[];
  /** Dex numbers of the filtered rows, for the bulk actions. */
  filteredDexes: number[];
  summary: ChecklistSummary;
}

/** One obtainability source with its location, method and evolution names resolved. */
export function describeSource(source: ObtainSource, view: GameView): ChecklistSource {
  const nameOf = (dex: number | undefined) =>
    dex === undefined ? '' : (view.speciesByDex.get(dex)?.name ?? `#${dex}`);
  const category = categoryOf(source);
  const base = { category, part: source.part };

  if (source.kind === 'evolution') {
    const detail = source.evolution && evolutionDetailText(source.evolution);
    return {
      ...base,
      label: `Evolves from ${nameOf(source.fromDex)}`,
      ...(detail === undefined ? {} : { detail }),
    };
  }
  if (source.kind === 'breeding') {
    return { ...base, label: `Breed ${nameOf(source.fromDex)}` };
  }

  const location = source.locationId ? view.locationById.get(source.locationId) : undefined;
  const method = source.method ? findMethod(source.method) : undefined;
  const detail =
    source.fromDex !== undefined ? `Trade for ${nameOf(source.fromDex)}` : method?.label;
  return {
    ...base,
    label: location?.name ?? source.locationId ?? 'Unknown',
    ...(detail === undefined ? {} : { detail }),
    ...(source.locationId === undefined ? {} : { locationId: source.locationId }),
  };
}

function buildRow(
  entry: ChecklistEntry,
  input: ChecklistInput,
  groupLabels: ReadonlyMap<string, string>,
): ChecklistRow {
  const { view, game, caught } = input;
  const species = view.speciesByDex.get(entry.dex);
  const sources = entry.sources.map((source) => describeSource(source, view));
  const categories = CATEGORY_ORDER.filter((category) =>
    sources.some((source) => source.category === category),
  );
  const regionalDex = species?.regionalDex?.[game];

  return {
    dex: entry.dex,
    name: species?.name ?? `#${entry.dex}`,
    slug: species?.slug ?? String(entry.dex),
    types: species?.types ?? [],
    caught: caught.has(entry.dex),
    obtainable: entry.obtainable,
    ...(regionalDex === undefined ? {} : { regionalDex }),
    categories,
    sources,
    ...(sources[0] === undefined ? {} : { earliest: sources[0] }),
    exclusiveGroupLabels: entry.exclusiveGroupIds.map((id) => groupLabels.get(id) ?? id),
    ...(entry.unobtainableReason === undefined
      ? {}
      : { unobtainableReason: entry.unobtainableReason }),
    ...(entry.unobtainableDetail === undefined
      ? {}
      : { unobtainableDetail: entry.unobtainableDetail }),
  };
}

function matchesSearch(row: ChecklistRow, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/^#/, '');
  if (/^\d+$/.test(digits) && String(row.dex) === String(Number(digits))) return true;
  return row.name.toLowerCase().includes(q) || row.slug.includes(q);
}

function matches(row: ChecklistRow, input: ChecklistInput): boolean {
  const { filters, progressPart } = input;
  if (filters.status === 'missing' && row.caught) return false;
  if (filters.status === 'caught' && !row.caught) return false;
  if (filters.types.size && !row.types.some((type) => filters.types.has(type))) return false;
  if (filters.categories.size && !row.categories.some((c) => filters.categories.has(c))) {
    return false;
  }
  if (filters.onlyAvailable && progressPart !== undefined) {
    if (!row.sources.some((source) => source.part <= progressPart)) return false;
  }
  return matchesSearch(row, filters.search);
}

const LAST = Number.MAX_SAFE_INTEGER;

function comparator(
  sort: ChecklistSort,
  view: GameView,
): (a: ChecklistRow, b: ChecklistRow) => number {
  if (sort === 'regional') {
    return (a, b) => (a.regionalDex ?? LAST) - (b.regionalDex ?? LAST) || a.dex - b.dex;
  }
  if (sort === 'walkthrough') {
    const order = new Map(view.locations.map((l, index) => [l.id, index]));
    const rank = (row: ChecklistRow) => {
      const earliest = row.earliest;
      if (!earliest) return [LAST, LAST] as const;
      const locationOrder = earliest.locationId ? (order.get(earliest.locationId) ?? LAST) : LAST;
      return [earliest.part, locationOrder] as const;
    };
    return (a, b) => {
      const [partA, orderA] = rank(a);
      const [partB, orderB] = rank(b);
      return partA - partB || orderA - orderB || a.dex - b.dex;
    };
  }
  return (a, b) => a.dex - b.dex;
}

/** Everything the checklist page shows, from one set of signals (plan §13.6). */
export function buildChecklistView(input: ChecklistInput): ChecklistView {
  const { view, entries, filters } = input;
  const groupLabels = new Map<string, string>();
  for (const groups of view.groupsByDex.values()) {
    for (const group of groups) groupLabels.set(group.id, group.label);
  }

  const all = entries.map((entry) => buildRow(entry, input, groupLabels));
  const rows = all.filter((row) => row.obtainable && matches(row, input));
  rows.sort(comparator(filters.sort, view));

  const categories = CATEGORY_ORDER.filter((category) =>
    all.some((row) => row.categories.includes(category)),
  );

  const obtainable = all.filter((row) => row.obtainable);
  const byType = new Map<PokemonType, TypeProgress>();
  for (const row of obtainable) {
    for (const type of row.types) {
      const found = byType.get(type) ?? { type, caught: 0, total: 0 };
      found.total++;
      if (row.caught) found.caught++;
      byType.set(type, found);
    }
  }

  return {
    rows,
    unobtainable: all.filter((row) => !row.obtainable),
    categories,
    filteredDexes: rows.map((row) => row.dex),
    summary: {
      caught: obtainable.filter((row) => row.caught).length,
      obtainable: obtainable.length,
      caughtExtra: all.filter((row) => !row.obtainable && row.caught).length,
      maxInOneSave: input.maxInOneSave,
      byType: [...byType.values()].sort((a, b) => b.total - a.total || a.type.localeCompare(b.type)),
    },
  };
}
