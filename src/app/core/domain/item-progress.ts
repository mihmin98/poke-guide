// FRAMEWORK-FREE: picked-up item counts and choice groups (plan §13.4, §13.5, Phase 9). No Angular imports.
import type { LocationItem } from './models';

export interface ItemProgress {
  taken: number;
  total: number;
}

/**
 * Items taken out of the items a location has. A choice group (Helix or Dome Fossil) counts as one
 * item, taken as soon as any of its options is. Never part of any "caught" figure.
 */
export function itemProgress(
  items: readonly LocationItem[],
  taken: ReadonlySet<number>,
): ItemProgress {
  const groups = new Map<string, boolean>();
  let total = 0;
  let count = 0;
  for (const item of items) {
    const has = taken.has(item.no);
    if (item.choiceGroupId) {
      groups.set(item.choiceGroupId, (groups.get(item.choiceGroupId) ?? false) || has);
      continue;
    }
    total++;
    if (has) count++;
  }
  for (const chosen of groups.values()) {
    total++;
    if (chosen) count++;
  }
  return { taken: count, total };
}

/** The name of the option picked instead of `item` in its choice group, when one is taken. */
export function chosenInstead(
  item: LocationItem,
  items: readonly LocationItem[],
  taken: ReadonlySet<number>,
): string | undefined {
  if (!item.choiceGroupId || taken.has(item.no)) return undefined;
  return items.find(
    (other) => other !== item && other.choiceGroupId === item.choiceGroupId && taken.has(other.no),
  )?.name;
}
