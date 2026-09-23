/**
 * Stable item numbers (plan §7.13, Phase 9). Profiles store picked-up items as `LocationItem.no`, and `PKG2`
 * codes carry them, so a number must keep pointing at the same item across rebuilds and is never reused.
 *
 * The committed registry (`version-groups/<id>/item-numbers.json`) remembers every live number. Each build
 * matches its items against it per `(locationId, subArea, itemId)` group: same `where` text first, then the
 * leftovers in page order (a warning each, since the page was reworded), then new numbers for what's left.
 * A registry entry that matches nothing is an error until `retiredItems` lists it. Pure functions;
 * `assemble.ts` turns the messages into build issues and `build.ts` writes the registry.
 */
import type { GameLocation, LocationItem } from '../../../src/app/core/domain/models';

/** What the parsers put in `no`; `assignItemNumbers` replaces it. Never valid in output. */
export const UNNUMBERED = 0;

export interface ItemNumberEntry {
  no: number;
  locationId: string;
  subArea: string | null;
  itemId: string;
  where: string;
}

export interface ItemNumberRegistry {
  versionGroupId: string;
  /** The next number to hand out; it never goes down, so retired numbers are never reused. */
  next: number;
  /** Live items, sorted by number. */
  items: ItemNumberEntry[];
}

export interface RetiredItem {
  no: number;
  reason: string;
}

export interface ItemNumberResult {
  registry: ItemNumberRegistry;
  errors: string[];
  warnings: string[];
  notes: string[];
}

const groupKey = (locationId: string, subArea: string | null, itemId: string) =>
  JSON.stringify([locationId, subArea, itemId]);

const describe = (e: Pick<ItemNumberEntry, 'locationId' | 'subArea' | 'itemId'>) =>
  `${e.itemId} in ${e.locationId}${e.subArea ? ` (${e.subArea})` : ''}`;

/**
 * Sets `no` on every item in place, in location and page order for new items, and returns the updated
 * registry. `previous` is `null` for a version group that has no registry yet.
 */
export function assignItemNumbers(
  locations: readonly GameLocation[],
  previous: ItemNumberRegistry | null,
  retired: readonly RetiredItem[],
  versionGroupId: string,
): ItemNumberResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const old = [...(previous?.items ?? [])].sort((a, b) => a.no - b.no);
  let next = previous?.next ?? 1;

  if (previous && previous.versionGroupId !== versionGroupId)
    errors.push(
      `Item number registry is for "${previous.versionGroupId}", not "${versionGroupId}"`,
    );
  const seen = new Set<number>();
  for (const entry of old) {
    if (!Number.isInteger(entry.no) || entry.no < 1 || entry.no >= next || seen.has(entry.no))
      errors.push(`Item number registry has an invalid or duplicate number ${entry.no}`);
    seen.add(entry.no);
  }

  const oldByGroup = new Map<string, ItemNumberEntry[]>();
  for (const entry of old) {
    const key = groupKey(entry.locationId, entry.subArea, entry.itemId);
    oldByGroup.set(key, [...(oldByGroup.get(key) ?? []), entry]);
  }
  const placed: { location: GameLocation; item: LocationItem }[] = locations.flatMap((location) =>
    location.items.map((item) => ({ location, item })),
  );
  const newByGroup = new Map<string, LocationItem[]>();
  for (const { location, item } of placed) {
    item.no = UNNUMBERED;
    const key = groupKey(location.id, item.subArea, item.itemId);
    newByGroup.set(key, [...(newByGroup.get(key) ?? []), item]);
  }

  const matched = new Set<ItemNumberEntry>();
  for (const [key, items] of newByGroup) {
    const candidates = oldByGroup.get(key) ?? [];
    for (const item of items) {
      const same = candidates.find((e) => !matched.has(e) && e.where === item.where);
      if (!same) continue;
      item.no = same.no;
      matched.add(same);
    }
    const leftovers = candidates.filter((e) => !matched.has(e));
    for (const item of items.filter((i) => i.no === UNNUMBERED)) {
      const entry = leftovers.shift();
      if (!entry) break;
      item.no = entry.no;
      matched.add(entry);
      warnings.push(
        `Item #${entry.no} ${describe(entry)} kept its number, but its text changed ` +
          `from "${entry.where}" to "${item.where}". Check that it's still the same spot.`,
      );
    }
  }

  const retiredByNo = new Map(retired.map((r) => [r.no, r]));
  for (const entry of old) {
    if (matched.has(entry)) {
      if (retiredByNo.has(entry.no))
        errors.push(`Item #${entry.no} ${describe(entry)} is retired but still in the data`);
      continue;
    }
    if (retiredByNo.has(entry.no)) notes.push(`Retired item #${entry.no} ${describe(entry)}`);
    else
      errors.push(
        `Item #${entry.no} ${describe(entry)} ("${entry.where}") is no longer in the data. If it's really ` +
          'gone, add it to retiredItems in overrides/items.ts with a reason; its number is never reused.',
      );
  }
  for (const r of retired) {
    if (!Number.isInteger(r.no) || r.no < 1 || r.no >= next)
      errors.push(`Retired item number ${r.no} was never handed out`);
  }

  let added = 0;
  for (const { item } of placed) {
    if (item.no !== UNNUMBERED) continue;
    item.no = next++;
    added++;
  }
  if (previous && added > 0) notes.push(`${added} new item number(s), up to #${next - 1}`);

  const items: ItemNumberEntry[] = placed
    .map(({ location, item }) => ({
      no: item.no,
      locationId: location.id,
      subArea: item.subArea,
      itemId: item.itemId,
      where: item.where,
    }))
    .sort((a, b) => a.no - b.no);
  return { registry: { versionGroupId, next, items }, errors, warnings, notes };
}

/** One entry per line, so a rebuild's changes read well in a diff. */
export function formatItemNumbers(registry: ItemNumberRegistry): string {
  const lines = registry.items.map((entry) => `    ${JSON.stringify(entry)}`);
  return (
    `{\n  "versionGroupId": ${JSON.stringify(registry.versionGroupId)},\n` +
    `  "next": ${registry.next},\n  "items": [\n${lines.join(',\n')}\n  ]\n}\n`
  );
}

/** Reads a registry file's JSON; throws when its shape is wrong, since numbers must never be guessed. */
export function parseItemNumbers(text: string): ItemNumberRegistry {
  const raw = JSON.parse(text) as Partial<ItemNumberRegistry>;
  if (
    typeof raw.versionGroupId !== 'string' ||
    !Number.isInteger(raw.next) ||
    !Array.isArray(raw.items) ||
    raw.items.some(
      (e) =>
        !Number.isInteger(e.no) ||
        typeof e.locationId !== 'string' ||
        (e.subArea !== null && typeof e.subArea !== 'string') ||
        typeof e.itemId !== 'string' ||
        typeof e.where !== 'string',
    )
  ) {
    throw new Error('The item number registry is malformed');
  }
  return raw as ItemNumberRegistry;
}
