// FRAMEWORK-FREE: the Story and Guide pages' shared walkthrough order (plan §13.13, Phase 18). No Angular imports.
import type { GameView } from './game-view';
import type { GameId, GameLocation, LocationItem, Milestone, RegionId } from './models';

/** What a location holds for one game at one point of the journey. */
export interface AreaReach {
  /** Species reachable at this point, in data order, without repeats. */
  dex: number[];
  /** Species only reachable later (behind an unlock you don't hold yet). */
  laterDex: number[];
  /** `LocationItem.no` values reachable at this point. */
  items: number[];
  laterItems: number[];
  /** Unlock ids that keep `laterDex` and `laterItems` out of reach, in first-seen order. */
  locks: string[];
}

export interface AreaStep {
  kind: 'area';
  location: GameLocation;
  reach: AreaReach;
}

export interface MilestoneStep {
  kind: 'milestone';
  milestone: Milestone;
  /** Its location is placed in an earlier part: you go back there. */
  revisit: boolean;
}

/** An earlier area whose reachable Pokémon or items grew at an `opens` step. */
export interface OpenedArea {
  location: GameLocation;
  /** Newly reachable species and items only. */
  dex: number[];
  items: number[];
}

export interface OpensStep {
  kind: 'opens';
  /** The milestone that opened them; absent for `fromPart` items released at the end of a part. */
  milestone?: Milestone;
  /** The unlocks the milestone granted (empty when only `fromPart` items were released). */
  unlocks: string[];
  areas: OpenedArea[];
}

export type JourneyStep = AreaStep | MilestoneStep | OpensStep;

export interface JourneyPart {
  part: number;
  title: string;
  region: RegionId | undefined;
  steps: JourneyStep[];
}

/** A location's encounters and items in one game, flattened for the reachability checks. */
interface AreaContent {
  encounters: { dex: number; requires: readonly string[] }[];
  items: LocationItem[];
}

function contentOf(location: GameLocation, game: GameId): AreaContent {
  const encounters: AreaContent['encounters'] = [];
  for (const subArea of location.subAreas) {
    for (const encounter of subArea.encounters) {
      if (encounter.games[game]?.length)
        encounters.push({ dex: encounter.dex, requires: encounter.requires ?? [] });
    }
  }
  return { encounters, items: location.items.filter((item) => item.games.includes(game)) };
}

function pushUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) list.push(value);
}

/**
 * Walks the walkthrough once, holding the unlocks granted so far, and records each step in order.
 *
 * Per part, milestones keep their curated order and locations their `placement` order: a milestone's anchor is
 * its location when that is placed in the part (else its `after`), and the areas up to the anchor come first.
 * A revisit milestone without `after` follows the previous step. Reachability at a step comes from the `grants`
 * of the milestones before it; an item with a later `fromPart` is released by the first milestone of that part at
 * its location, or at the end of the part.
 */
export function buildJourney(view: GameView, game: GameId): JourneyPart[] {
  const held = new Set<string>();
  const released = new Set<number>();
  const contents = new Map<string, AreaContent>();
  const content = (location: GameLocation): AreaContent => {
    let found = contents.get(location.id);
    if (!found) {
      found = contentOf(location, game);
      contents.set(location.id, found);
    }
    return found;
  };

  const itemReachable = (item: LocationItem): boolean =>
    (item.requires ?? []).every((group) => group.some((id) => held.has(id))) &&
    (item.fromPart?.[game] === undefined || released.has(item.no));

  const reachOf = (location: GameLocation): AreaReach => {
    const reach: AreaReach = { dex: [], laterDex: [], items: [], laterItems: [], locks: [] };
    const { encounters, items } = content(location);
    for (const encounter of encounters) {
      const missing = encounter.requires.filter((id) => !held.has(id));
      if (missing.length === 0) pushUnique(reach.dex, encounter.dex);
      for (const id of missing) pushUnique(reach.locks, id);
    }
    for (const encounter of encounters) {
      if (!reach.dex.includes(encounter.dex)) pushUnique(reach.laterDex, encounter.dex);
    }
    for (const item of items) {
      if (itemReachable(item)) reach.items.push(item.no);
      else {
        reach.laterItems.push(item.no);
        for (const group of item.requires ?? []) {
          if (!group.some((id) => held.has(id)))
            for (const id of group) pushUnique(reach.locks, id);
        }
      }
    }
    return reach;
  };

  /** What each area already passed held when last looked at, in the order they were passed. */
  const passed = new Map<
    string,
    { location: GameLocation; dex: Set<number>; items: Set<number> }
  >();
  const opened = (): OpenedArea[] => {
    const areas: OpenedArea[] = [];
    for (const seen of passed.values()) {
      const reach = reachOf(seen.location);
      const dex = reach.dex.filter((d) => !seen.dex.has(d));
      const items = reach.items.filter((no) => !seen.items.has(no));
      if (dex.length === 0 && items.length === 0) continue;
      for (const d of dex) seen.dex.add(d);
      for (const no of items) seen.items.add(no);
      areas.push({ location: seen.location, dex, items });
    }
    return areas;
  };

  const locationsByPart = new Map<number, GameLocation[]>();
  for (const location of view.locations) {
    const part = location.placement[game]!.part;
    locationsByPart.set(part, [...(locationsByPart.get(part) ?? []), location]);
  }
  const milestonesByPart = new Map<number, Milestone[]>();
  for (const milestone of view.milestones) {
    const part = milestone.part[game]!;
    milestonesByPart.set(part, [...(milestonesByPart.get(part) ?? []), milestone]);
  }
  const titles = new Map(view.walkthrough.map((w) => [w.part, w]));
  const parts = [
    ...new Set([
      ...view.walkthrough.map((w) => w.part),
      ...locationsByPart.keys(),
      ...milestonesByPart.keys(),
    ]),
  ].sort((a, b) => a - b);

  /** Items reachable only from a later part than their location's, with where they are. */
  const delayed = view.locations.flatMap((location) =>
    content(location)
      .items.filter((item) => item.fromPart?.[game] !== undefined)
      .map((item) => ({ item, locationId: location.id })),
  );

  const result: JourneyPart[] = [];
  for (const part of parts) {
    const locations = locationsByPart.get(part) ?? [];
    const steps: JourneyStep[] = [];
    let cursor = 0;
    const emitAreasThrough = (index: number) => {
      for (; cursor <= index; cursor++) {
        const location = locations[cursor]!;
        const reach = reachOf(location);
        passed.set(location.id, {
          location,
          dex: new Set(reach.dex),
          items: new Set(reach.items),
        });
        steps.push({ kind: 'area', location, reach });
      }
    };
    for (const milestone of milestonesByPart.get(part) ?? []) {
      let index = locations.findIndex((l) => l.id === milestone.locationId);
      const home = view.locationById.get(milestone.locationId)?.placement[game]?.part;
      if (index < 0 && milestone.after)
        index = locations.findIndex((l) => l.id === milestone.after);
      if (index >= cursor) emitAreasThrough(index);
      steps.push({
        kind: 'milestone',
        milestone,
        revisit: home !== undefined && home < part,
      });

      for (const id of milestone.grants ?? []) held.add(id);
      for (const { item, locationId } of delayed) {
        if (locationId === milestone.locationId && item.fromPart![game]! <= part)
          released.add(item.no);
      }
      const areas = opened();
      if (areas.length)
        steps.push({ kind: 'opens', milestone, unlocks: [...(milestone.grants ?? [])], areas });
    }
    emitAreasThrough(locations.length - 1);

    // `fromPart` items no milestone of the part released become reachable as the part ends.
    const late = delayed.filter(
      ({ item }) => item.fromPart![game]! <= part && !released.has(item.no),
    );
    if (late.length) {
      for (const { item } of late) released.add(item.no);
      const areas = opened();
      if (areas.length) steps.push({ kind: 'opens', unlocks: [], areas });
    }

    const walkthrough = titles.get(part);
    result.push({
      part,
      title: walkthrough?.title ?? `Part ${part}`,
      region: walkthrough?.region ?? locations[0]?.region,
      steps,
    });
  }
  return result.filter((p) => p.steps.length > 0);
}

export interface MilestoneContext {
  /** The walkthrough part the area belongs to. */
  part: number;
  /** The last milestone before the area, if any. */
  previous?: Milestone;
  /** The first milestone after it, if any. */
  next?: Milestone;
}

/** Where a location sits among the milestones: the ones just before and after its area step. */
export function milestoneContext(
  journey: readonly JourneyPart[],
  locationId: string,
): MilestoneContext | undefined {
  let previous: Milestone | undefined;
  let found: MilestoneContext | undefined;
  for (const part of journey) {
    for (const step of part.steps) {
      if (step.kind === 'milestone') {
        if (found) return { ...found, next: step.milestone };
        previous = step.milestone;
      } else if (step.kind === 'area' && step.location.id === locationId && !found) {
        found = { part: part.part, ...(previous && { previous }) };
      }
    }
  }
  return found;
}
