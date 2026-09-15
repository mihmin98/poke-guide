// Pure view model for the guide page (plan §13.4): no Angular, so it can be unit-tested on its own.
import { encountersFor, type GameView } from '../../core/domain/game-view';
import type {
  GameId,
  GameLocation,
  LocationKind,
  RegionId,
  Species,
} from '../../core/domain/models';
import { ENCOUNTER_METHODS, type EncounterMethodCategory } from '../../core/games/methods';

const CATEGORY_LABELS: Record<EncounterMethodCategory, string> = {
  wild: 'Walking',
  water: 'Surfing',
  fishing: 'Fishing',
  gift: 'Gifts',
  trade: 'Trades',
  static: 'Static',
  prize: 'Prizes',
  fossil: 'Fossils',
  egg: 'Breeding',
};

export function categoryLabel(category: EncounterMethodCategory): string {
  return CATEGORY_LABELS[category];
}

const KIND_ICONS: Record<LocationKind, string> = {
  town: 'location_city',
  route: 'route',
  cave: 'landscape',
  building: 'apartment',
  water: 'waves',
  special: 'star',
};

export function locationIcon(kind: LocationKind): string {
  return KIND_ICONS[kind];
}

export interface GuideSpecies {
  dex: number;
  name: string;
  caught: boolean;
}

export interface GuideRequirement {
  id: string;
  label: string;
  /** The unlock comes later than the profile's progress part. */
  locked: boolean;
}

export interface GuideLocation {
  id: string;
  name: string;
  kind: LocationKind;
  icon: string;
  part: number;
  species: GuideSpecies[];
  caught: number;
  total: number;
  complete: boolean;
  requirements: GuideRequirement[];
}

export interface GuidePart {
  part: number;
  title: string;
  region: RegionId | undefined;
  locations: GuideLocation[];
  caught: number;
  total: number;
}

export interface GuideFilters {
  /** Matches location names and the species found there. */
  search: string;
  hideCompleted: boolean;
  /** Needs `progressPart`; hides locations from later parts. */
  onlyAvailable: boolean;
  /** Empty means every category. */
  categories: ReadonlySet<EncounterMethodCategory>;
  /** Keep locations with no encounters at all (`showEmptyLocations`). */
  showEmpty: boolean;
}

export interface GuideInput {
  view: GameView;
  game: GameId;
  caught: ReadonlySet<number>;
  progressPart?: number;
  filters: GuideFilters;
}

/** The encounter categories a game actually has, in method registry order (plan §13.4 chips). */
export function categoriesIn(view: GameView, game: GameId): EncounterMethodCategory[] {
  const found = new Set<EncounterMethodCategory>();
  for (const location of view.locations) {
    for (const subArea of encountersFor(location, game)) {
      for (const section of subArea.sections) found.add(section.method.category);
    }
  }
  const ordered: EncounterMethodCategory[] = [];
  for (const method of ENCOUNTER_METHODS) {
    if (found.has(method.category) && !ordered.includes(method.category)) {
      ordered.push(method.category);
    }
  }
  return ordered;
}

function speciesName(view: GameView, dex: number): string {
  const species: Species | undefined = view.speciesByDex.get(dex);
  return species?.name ?? `#${dex}`;
}

function buildLocation(location: GameLocation, input: GuideInput): GuideLocation | null {
  const { view, game, caught, filters } = input;
  const byDex = new Map<number, GuideSpecies>();
  const requirementIds = new Set<string>();

  for (const subArea of encountersFor(location, game)) {
    for (const section of subArea.sections) {
      if (filters.categories.size && !filters.categories.has(section.method.category)) continue;
      for (const encounter of section.encounters) {
        if (!byDex.has(encounter.dex)) {
          byDex.set(encounter.dex, {
            dex: encounter.dex,
            name: speciesName(view, encounter.dex),
            caught: caught.has(encounter.dex),
          });
        }
        for (const id of encounter.requires ?? []) requirementIds.add(id);
      }
    }
  }

  const species = [...byDex.values()];
  const total = species.length;
  if (total === 0 && !(filters.showEmpty && !filters.categories.size && !filters.search.trim())) {
    return null;
  }

  const caughtCount = species.filter((s) => s.caught).length;
  const unlockById = new Map(view.unlocks.map((u) => [u.id, u]));
  const requirements: GuideRequirement[] = [...requirementIds].map((id) => {
    const unlock = unlockById.get(id);
    return {
      id,
      label: unlock?.label ?? id,
      locked:
        input.progressPart !== undefined &&
        unlock !== undefined &&
        unlock.part > input.progressPart,
    };
  });

  return {
    id: location.id,
    name: location.name,
    kind: location.kind,
    icon: locationIcon(location.kind),
    part: location.placement[game]?.part ?? 0,
    species,
    caught: caughtCount,
    total,
    complete: total > 0 && caughtCount === total,
    requirements,
  };
}

function matchesSearch(location: GuideLocation, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    location.name.toLowerCase().includes(q) ||
    location.species.some((s) => s.name.toLowerCase().includes(q))
  );
}

function regionOf(
  view: GameView,
  fromWalkthrough: RegionId | undefined,
  locations: readonly GuideLocation[],
): RegionId | undefined {
  if (fromWalkthrough) return fromWalkthrough;
  const first = locations[0];
  return first ? view.locationById.get(first.id)?.region : undefined;
}

/**
 * The guide's parts in walkthrough order, with their locations filtered. Parts that end up empty
 * are dropped; part counts describe the locations that are left.
 */
export function buildGuide(input: GuideInput): GuidePart[] {
  const { view, filters, progressPart } = input;
  const byPart = new Map<number, GuideLocation[]>();

  for (const location of view.locations) {
    const built = buildLocation(location, input);
    if (!built) continue;
    if (filters.hideCompleted && built.complete) continue;
    if (filters.onlyAvailable && progressPart !== undefined && built.part > progressPart) continue;
    if (!matchesSearch(built, filters.search)) continue;
    const list = byPart.get(built.part);
    if (list) list.push(built);
    else byPart.set(built.part, [built]);
  }

  const titles = new Map(view.walkthrough.map((p) => [p.part, p]));
  return [...byPart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([part, locations]) => ({
      part,
      title: titles.get(part)?.title ?? `Part ${part}`,
      region: regionOf(view, titles.get(part)?.region, locations),
      locations,
      caught: locations.reduce((sum, l) => sum + l.caught, 0),
      total: locations.reduce((sum, l) => sum + l.total, 0),
    }));
}
