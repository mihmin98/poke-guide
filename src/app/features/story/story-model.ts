// Pure view model for the Story page (plan §13.12, §13.13): no Angular, so it can be unit-tested on its own.
import type { GameView } from '../../core/domain/game-view';
import { itemProgress, type ItemProgress } from '../../core/domain/item-progress';
import type { JourneyPart } from '../../core/domain/journey';
import { encounterLevels } from '../../core/domain/milestone-levels';
import { milestoneProgress, type MilestoneProgress } from '../../core/domain/milestone-progress';
import type {
  GameId,
  LevelSpec,
  LocationItem,
  Milestone,
  RegionId,
} from '../../core/domain/models';
import { locationIcon } from '../guide/guide-model';

export interface StoryMilestoneRow {
  kind: 'milestone';
  key: string;
  milestone: Milestone;
  done: boolean;
  location: { id: string; name: string } | undefined;
  /** The milestone takes you back to an area from an earlier part. */
  revisit: boolean;
  species: { name: string; slug: string } | undefined;
  /** A static encounter's or gift's levels (Phase 19). */
  levels: LevelSpec | null;
}

export interface StorySpecies {
  dex: number;
  name: string;
  caught: boolean;
}

/** An area as you reach it: only what is reachable at that point counts (plan §13.13). */
export interface StoryAreaRow {
  kind: 'area';
  key: string;
  id: string;
  name: string;
  icon: string;
  species: StorySpecies[];
  caught: number;
  items: ItemProgress;
  /** Species and items only reachable later, and what they wait for. */
  later: number;
  locks: string[];
  /** Everything reachable here is caught and taken. */
  finished: boolean;
}

export interface StoryOpenedArea {
  id: string;
  name: string;
  /** Newly reachable species not caught yet. */
  species: StorySpecies[];
  /** Newly reachable items not taken yet. */
  items: number;
}

/** "Surf opens…": earlier areas with newly reachable Pokémon or items still needed. */
export interface StoryOpensRow {
  kind: 'opens';
  key: string;
  label: string;
  areas: StoryOpenedArea[];
}

export type StoryRow = StoryMilestoneRow | StoryAreaRow | StoryOpensRow;

export interface StoryPart {
  part: number;
  title: string;
  region: RegionId | undefined;
  rows: StoryRow[];
  /** Over every milestone of the part, whatever the filters show. */
  progress: MilestoneProgress;
}

export interface StoryInput {
  view: GameView;
  journey: readonly JourneyPart[];
  game: GameId;
  done: ReadonlySet<number>;
  caught: ReadonlySet<number>;
  /** `LocationItem.no` values taken, already narrowed to this game's profile. */
  itemsTaken: ReadonlySet<number>;
  hideDone: boolean;
  hideFinished: boolean;
}

/**
 * The game's journey as Story rows, part by part: milestones, the areas between them and what later unlocks
 * open. Areas with neither Pokémon nor items get no row; parts the filters empty are left out.
 */
export function buildStory(input: StoryInput): StoryPart[] {
  const { view, journey, game, done, caught, itemsTaken, hideDone, hideFinished } = input;
  const unlockLabels = new Map(view.unlocks.map((u) => [u.id, u.label]));
  const speciesOf = (dex: number): StorySpecies => ({
    dex,
    name: view.speciesByDex.get(dex)?.name ?? `#${dex}`,
    caught: caught.has(dex),
  });
  const itemsOf = (locationId: string, numbers: readonly number[]): LocationItem[] => {
    const wanted = new Set(numbers);
    return (view.locationById.get(locationId)?.items ?? []).filter((item) => wanted.has(item.no));
  };

  const parts: StoryPart[] = [];
  for (const part of journey) {
    const rows: StoryRow[] = [];
    const milestones: Milestone[] = [];
    part.steps.forEach((step, index) => {
      if (step.kind === 'milestone') {
        const { milestone } = step;
        milestones.push(milestone);
        if (hideDone && done.has(milestone.no)) return;
        const location = view.locationById.get(milestone.locationId);
        const species =
          milestone.dex === undefined ? undefined : view.speciesByDex.get(milestone.dex);
        rows.push({
          kind: 'milestone',
          key: `m${milestone.no}`,
          milestone,
          done: done.has(milestone.no),
          location: location && { id: location.id, name: location.name },
          revisit: step.revisit,
          species: species && { name: species.name, slug: species.slug },
          levels: encounterLevels(milestone, game, location),
        });
      } else if (step.kind === 'area') {
        const { location, reach } = step;
        const hasContent =
          reach.dex.length + reach.laterDex.length + reach.items.length + reach.laterItems.length >
          0;
        if (!hasContent) return;
        const species = reach.dex.map(speciesOf);
        const caughtHere = species.filter((s) => s.caught).length;
        const items = itemProgress(itemsOf(location.id, reach.items), itemsTaken);
        const finished = caughtHere === species.length && items.taken === items.total;
        if (hideFinished && finished) return;
        rows.push({
          kind: 'area',
          key: `a-${location.id}`,
          id: location.id,
          name: location.name,
          icon: locationIcon(location.kind),
          species,
          caught: caughtHere,
          items,
          later: reach.laterDex.length + reach.laterItems.length,
          locks: reach.locks.map((id) => unlockLabels.get(id) ?? id),
          finished,
        });
      } else {
        const areas = step.areas
          .map((area): StoryOpenedArea => ({
            id: area.location.id,
            name: area.location.name,
            species: area.dex.map(speciesOf).filter((s) => !s.caught),
            items: area.items.filter((no) => !itemsTaken.has(no)).length,
          }))
          .filter((area) => area.species.length > 0 || area.items > 0);
        if (areas.length === 0) return;
        rows.push({
          kind: 'opens',
          key: `o${part.part}-${index}`,
          label: step.unlocks.map((id) => unlockLabels.get(id) ?? id).join(', ') || 'Later items',
          areas,
        });
      }
    });
    if (rows.length === 0) continue;
    parts.push({
      part: part.part,
      title: part.title,
      region: part.region,
      rows,
      progress: milestoneProgress(milestones, done),
    });
  }
  return parts;
}
