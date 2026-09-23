/**
 * Location items after parsing (plan §7.13): curated overrides, the prerequisite check against unlocks and the
 * walkthrough cross-check. Pure functions; `assemble.ts` turns their messages into build issues.
 */
import type {
  GameId,
  GameLocation,
  LocationItem,
  Unlock,
} from '../../../src/app/core/domain/models';
import { UNNUMBERED, type RetiredItem } from './item-numbers';
import { slugify } from './slug';

export interface ItemAddition {
  locationId: string;
  /** `itemId` is derived from the name. */
  item: Omit<LocationItem, 'no' | 'itemId' | 'source'>;
  /** Page the item is taken from; its revid is recorded at build time. */
  sourcePage: string;
  reason: string;
}

export interface ItemRequirementOverride {
  locationId: string;
  itemId: string;
  /** Narrows the match when the item appears more than once. */
  subArea?: string;
  /** Added to the requirements the page states. */
  requires: string[][];
  sourcePage: string;
  reason: string;
}

export interface ItemChoiceGroup {
  locationId: string;
  itemIds: string[];
  /** Exclusive group id (plan §7.7). */
  groupId: string;
}

/** Corrects fields of exactly one parsed item; a new name also changes its id. */
export interface ItemPatch {
  locationId: string;
  itemId: string;
  subArea?: string;
  set: Partial<Pick<LocationItem, 'name' | 'quantity' | 'games' | 'where' | 'obtain'>>;
  /** Page that shows the correct value (or a source link in `reason`); its revid is recorded. */
  sourcePage: string;
  reason: string;
}

/** A walkthrough quantity difference that is expected (items left out on purpose). */
export interface WalkthroughAccepted {
  itemId: string;
  games: readonly GameId[];
  reason: string;
}

/** Walkthrough part page whose rows carry the wrong game flags; its rows count for these games instead. */
export interface WalkthroughGamesFix {
  page: string;
  games: readonly GameId[];
  reason: string;
}

export interface ItemOverrides {
  /** Plain-text `(requires …)` terms → unlock ids; `null` drops a term that belongs to other games. */
  requirementPhrases: Readonly<Record<string, string | null>>;
  add: readonly ItemAddition[];
  requires: readonly ItemRequirementOverride[];
  choiceGroups: readonly ItemChoiceGroup[];
  patch?: readonly ItemPatch[];
  walkthroughAccepted?: readonly WalkthroughAccepted[];
  walkthroughGames?: readonly WalkthroughGamesFix[];
  /** Item numbers whose item is gone from the data for good (plan §7.13); never handed out again. */
  retiredItems?: readonly RetiredItem[];
}

/** Looks a page up (recording it as a source); `null` when it's not available, which the lookup reports itself. */
export type SourceLookup = (title: string) => { title: string; revid: number } | null;

export interface WalkthroughItems {
  /** Walkthrough part page title. */
  page: string;
  part: number;
  game: GameId;
  items: readonly LocationItem[];
}

export interface PageMessage {
  page: string;
  message: string;
}

const requirementIds = (item: LocationItem) => new Set((item.requires ?? []).flat());

/** Applies additions, unstated requirements and choice groups in place. Returns errors; every entry must match. */
export function applyItemOverrides(
  locations: GameLocation[],
  overrides: ItemOverrides,
  sourceOf: SourceLookup,
): string[] {
  const errors: string[] = [];
  const byId = new Map(locations.map((l) => [l.id, l]));
  const locationOf = (id: string, what: string) => {
    const location = byId.get(id);
    if (!location) errors.push(`Item override for ${what} names unknown location "${id}"`);
    return location;
  };

  for (const patch of overrides.patch ?? []) {
    const location = locationOf(patch.locationId, patch.itemId);
    if (!location) continue;
    const matches = location.items.filter(
      (i) =>
        i.itemId === patch.itemId && (patch.subArea === undefined || i.subArea === patch.subArea),
    );
    if (matches.length !== 1) {
      errors.push(
        `Item patch for ${patch.itemId} in ${location.id} matches ${matches.length} items, expected 1`,
      );
      continue;
    }
    const item = matches[0]!;
    const unchanged = Object.entries(patch.set).every(
      ([key, value]) => JSON.stringify(item[key as keyof LocationItem]) === JSON.stringify(value),
    );
    if (unchanged) {
      errors.push(`Item patch for ${patch.itemId} in ${location.id} changes nothing`);
      continue;
    }
    if (!sourceOf(patch.sourcePage)) continue;
    Object.assign(item, patch.set);
    if (patch.set.name !== undefined) item.itemId = slugify(patch.set.name);
  }

  for (const addition of overrides.add) {
    const location = locationOf(addition.locationId, addition.item.name);
    const source = sourceOf(addition.sourcePage);
    if (!location || !source) continue;
    const itemId = slugify(addition.item.name);
    if (location.items.some((i) => i.itemId === itemId && !i.source)) {
      errors.push(
        `Item override adds ${addition.item.name} to ${location.id}, but the page already lists it`,
      );
      continue;
    }
    location.items.push({ no: UNNUMBERED, itemId, ...addition.item, source });
  }

  for (const override of overrides.requires) {
    const location = locationOf(override.locationId, override.itemId);
    if (!location) continue;
    const matches = location.items.filter(
      (i) =>
        i.itemId === override.itemId &&
        (override.subArea === undefined || i.subArea === override.subArea),
    );
    if (matches.length !== 1) {
      errors.push(
        `Requirement override for ${override.itemId} in ${location.id} matches ${matches.length} items, expected 1`,
      );
      continue;
    }
    const item = matches[0]!;
    const stated = requirementIds(item);
    if (override.requires.flat().every((id) => stated.has(id))) {
      errors.push(
        `Requirement override for ${override.itemId} in ${location.id} is already stated by the page`,
      );
      continue;
    }
    if (!sourceOf(override.sourcePage)) continue;
    item.requires = [...(item.requires ?? []), ...override.requires.map((group) => [...group])];
  }

  for (const group of overrides.choiceGroups) {
    const location = locationOf(group.locationId, group.groupId);
    if (!location) continue;
    for (const itemId of group.itemIds) {
      const matches = location.items.filter((i) => i.itemId === itemId && i.obtain === 'choice');
      if (matches.length === 0)
        errors.push(`Choice group ${group.groupId} has no choice item ${itemId} in ${location.id}`);
      for (const item of matches) item.choiceGroupId = group.groupId;
    }
  }
  return errors;
}

/** Errors for requirement ids that aren't unlocks in every game of the item, and unlocks at unknown locations. */
export function checkItemRequirements(
  locations: readonly GameLocation[],
  unlocks: Partial<Record<GameId, readonly Unlock[]>>,
): string[] {
  const errors: string[] = [];
  const locationIds = new Set(locations.map((l) => l.id));
  for (const [game, list] of Object.entries(unlocks)) {
    for (const unlock of list ?? []) {
      if (!locationIds.has(unlock.locationId))
        errors.push(
          `Unlock "${unlock.id}" (${game}) is at unknown location "${unlock.locationId}"`,
        );
    }
  }
  for (const location of locations) {
    for (const item of location.items) {
      for (const id of requirementIds(item)) {
        const missing = item.games.filter((game) => !unlocks[game]?.some((u) => u.id === id));
        if (missing.length > 0) {
          errors.push(
            `${item.name} in ${location.id} requires "${id}", which is not an unlock in ${missing.join(', ')}`,
          );
        }
      }
    }
  }
  return errors;
}

interface Tally {
  name: string;
  quantity: number;
  /** Walkthrough part of each occurrence. */
  parts: number[];
  items: LocationItem[];
}

function tally(map: Map<string, Tally>, part: number, item: LocationItem): void {
  const entry = map.get(item.itemId) ?? { name: item.name, quantity: 0, parts: [], items: [] };
  entry.quantity += item.quantity;
  entry.parts.push(part);
  entry.items.push(item);
  map.set(item.itemId, entry);
}

/**
 * Compares each item's total quantity per game with the location data, and reports walkthrough requirements that
 * no location item with that id has. Totals, not parts, are compared: walkthrough parts group some places
 * differently (Route 2's east side, the Pewter Museum). Messages name the walkthrough part page where the item
 * first appears, and games that share a walkthrough page produce one message.
 */
export function diffWalkthroughItems(
  locations: readonly GameLocation[],
  walkthrough: readonly WalkthroughItems[],
  accepted: readonly WalkthroughAccepted[] = [],
): PageMessage[] {
  const messages: PageMessage[] = [];
  const seen = new Set<string>();
  const push = (page: string, message: string) => {
    const key = `${page}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    messages.push({ page, message });
  };

  for (const game of [...new Set(walkthrough.map((w) => w.game))]) {
    const located = new Map<string, Tally>();
    for (const location of locations) {
      const part = location.placement[game]?.part;
      for (const item of location.items) {
        const itemPart = item.fromPart?.[game] ?? part;
        if (item.games.includes(game) && itemPart !== undefined) tally(located, itemPart, item);
      }
    }
    const listed = new Map<string, Tally>();
    const pages = new Map<number, string>();
    for (const entry of walkthrough) {
      if (entry.game !== game) continue;
      pages.set(entry.part, entry.page);
      for (const item of entry.items)
        if (item.games.includes(game)) tally(listed, entry.part, item);
    }

    const firstPart = (itemId: string) =>
      Math.min(...(listed.get(itemId)?.parts ?? located.get(itemId)?.parts ?? [0]));
    const keys = [...new Set([...located.keys(), ...listed.keys()])].sort(
      (a, b) => firstPart(a) - firstPart(b),
    );
    for (const key of keys) {
      const part = firstPart(key);
      const page = pages.get(part) ?? `Part ${part}`;
      const inData = located.get(key);
      const inWalkthrough = listed.get(key);
      const name = (inData ?? inWalkthrough)!.name;
      const isAccepted = accepted.some((a) => a.itemId === key && a.games.includes(game));
      if (!isAccepted && (inData?.quantity ?? 0) !== (inWalkthrough?.quantity ?? 0)) {
        push(
          page,
          `${name}: ×${inWalkthrough?.quantity ?? 0} in the walkthrough, ×${inData?.quantity ?? 0} in the location data`,
        );
      }
      for (const item of inWalkthrough?.items ?? []) {
        const ids = [...requirementIds(item)];
        if (ids.length === 0) continue;
        const covered = (inData?.items ?? []).some((l) =>
          ids.every((id) => requirementIds(l).has(id)),
        );
        if (!covered)
          push(
            page,
            `${item.name}: the walkthrough says it requires ${ids.join(' + ')} ("${item.where}")`,
          );
      }
    }
  }
  return messages;
}
