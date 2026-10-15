// Pure view model for the guide page (plan §13.4): no Angular, so it can be unit-tested on its own.
import { encountersFor, type GameView } from '../../core/domain/game-view';
import { itemProgress, type ItemProgress } from '../../core/domain/item-progress';
import type { JourneyPart } from '../../core/domain/journey';
import { encounterLevels } from '../../core/domain/milestone-levels';
import { milestoneProgress, type MilestoneProgress } from '../../core/domain/milestone-progress';
import type {
  GameId,
  GameLocation,
  LevelSpec,
  LocationKind,
  Milestone,
  RegionId,
  Species,
} from '../../core/domain/models';
import { ENCOUNTER_METHODS, type EncounterMethodCategory } from '../../core/games/methods';
import { icon } from '../../shared/icon';

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
  town: icon('location_city'),
  route: icon('route'),
  cave: icon('landscape'),
  building: icon('apartment'),
  water: icon('waves'),
  special: icon('star'),
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
  /** Items picked up here (Phase 9). Never part of `caught`, `complete` or any part count. */
  items: ItemProgress;
}

/** A story milestone between the location cards (plan §13.13). */
export interface GuideMilestone {
  milestone: Milestone;
  done: boolean;
  /** Its location is from an earlier part; linked as "Back to …". */
  revisit: { id: string; name: string } | undefined;
  /** A static encounter's or gift's levels (Phase 19). */
  levels: LevelSpec | null;
}

export type GuideRow =
  | { kind: 'location'; key: string; location: GuideLocation }
  | ({ kind: 'milestone'; key: string } & GuideMilestone);

export interface GuidePart {
  part: number;
  title: string;
  region: RegionId | undefined;
  /** Location cards and, with `showStory`, milestones, in journey order. */
  rows: GuideRow[];
  locations: GuideLocation[];
  /** Pokémon only (items and milestones never count). */
  caught: number;
  total: number;
  /** Every milestone of the part, whatever the filters show; `total` 0 without a story checklist. */
  story: MilestoneProgress;
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
  /** Story milestones between the cards (`guideShowStory`, plan §13.13). */
  showStory: boolean;
}

export interface GuideInput {
  view: GameView;
  /** The walkthrough order of locations and milestones (`GameDataView.journey`). */
  journey: readonly JourneyPart[];
  game: GameId;
  caught: ReadonlySet<number>;
  /** `LocationItem.no` values taken, already narrowed to this game's profile. */
  itemsTaken: ReadonlySet<number>;
  /** `Milestone.no` values done, already narrowed to this game's profile. */
  milestonesDone: ReadonlySet<number>;
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
    items: itemProgress(
      location.items.filter((item) => item.games.includes(game)),
      input.itemsTaken,
    ),
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

/**
 * The guide's parts in walkthrough order, with their locations filtered and, with `showStory`, the story
 * milestones between them (plan §13.13). Search also matches milestone labels; "Hide completed" hides done
 * milestones; the category chips leave them alone. Parts that end up empty are dropped; part counts describe
 * the locations that are left.
 */
export function buildGuide(input: GuideInput): GuidePart[] {
  const { view, journey, game, filters, progressPart, milestonesDone } = input;
  const query = filters.search.trim().toLowerCase();
  const parts: GuidePart[] = [];

  for (const part of journey) {
    if (filters.onlyAvailable && progressPart !== undefined && part.part > progressPart) continue;
    const rows: GuideRow[] = [];
    const locations: GuideLocation[] = [];
    const milestones: Milestone[] = [];
    for (const step of part.steps) {
      if (step.kind === 'area') {
        const built = buildLocation(step.location, input);
        if (!built) continue;
        if (filters.hideCompleted && built.complete) continue;
        if (!matchesSearch(built, filters.search)) continue;
        locations.push(built);
        rows.push({ kind: 'location', key: `l-${built.id}`, location: built });
      } else if (step.kind === 'milestone') {
        const { milestone } = step;
        milestones.push(milestone);
        const done = milestonesDone.has(milestone.no);
        if (!filters.showStory || (filters.hideCompleted && done)) continue;
        if (query && !milestone.label.toLowerCase().includes(query)) continue;
        const where = step.revisit ? view.locationById.get(milestone.locationId) : undefined;
        rows.push({
          kind: 'milestone',
          key: `m-${milestone.no}`,
          milestone,
          done,
          revisit: where && { id: where.id, name: where.name },
          levels: encounterLevels(milestone, game, view.locationById.get(milestone.locationId)),
        });
      }
    }
    if (rows.length === 0) continue;
    parts.push({
      part: part.part,
      title: part.title,
      region: part.region,
      rows,
      locations,
      caught: locations.reduce((sum, l) => sum + l.caught, 0),
      total: locations.reduce((sum, l) => sum + l.total, 0),
      story: milestoneProgress(milestones, milestonesDone),
    });
  }
  return parts;
}
