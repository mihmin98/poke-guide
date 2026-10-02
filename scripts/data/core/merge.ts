/**
 * Merges walked rows into sub-areas and encounters with per-game slots (plan §7.4 step 7).
 * Rows are grouped by (sub-area, method, dex, label, traded species). Within one game, slots with the same
 * conditions and percentage rates are combined: levels are unioned and rates added (split table rows).
 * Afterwards a morning, day and night slot that are otherwise identical collapse into one slot without a
 * time condition, so time-of-day games only keep the times that actually differ.
 */
import type {
  Encounter,
  EncounterCondition,
  EncounterSlot,
  GameId,
  SubArea,
} from '../../../src/app/core/domain/models';
import type { RawSlot } from '../adapters/catch-template-adapter';
import type { WalkedRow } from './encounter-walker';
import { unionLevels } from './levels';
import { slugify } from './slug';

export function mergeRows(rows: readonly WalkedRow[], games: readonly GameId[]): SubArea[] {
  const subAreas = new Map<string, SubArea>();
  const encounters = new Map<string, Encounter>();

  for (const { row, method, requires, subArea, label } of rows) {
    const subAreaId = subArea ? slugify(subArea) : 'main';
    let area = subAreas.get(subAreaId);
    if (!area) {
      area = { id: subAreaId, name: subArea, encounters: [] };
      subAreas.set(subAreaId, area);
    }

    const key = [subAreaId, method, row.dex, label ?? '', row.trade?.giveDex ?? ''].join('|');
    let encounter = encounters.get(key);
    if (!encounter) {
      encounter = {
        dex: row.dex,
        method,
        games: {},
        ...(label ? { label } : {}),
        ...(row.trade ? { trade: { giveDex: row.trade.giveDex } } : {}),
      };
      encounters.set(key, encounter);
      area.encounters.push(encounter);
    }
    if (requires.length > 0) {
      encounter.requires = [...new Set([...(encounter.requires ?? []), ...requires])];
    }

    for (const game of row.games) {
      if (!games.includes(game)) continue;
      const slots = (encounter.games[game] ??= []);
      for (const raw of row.slots) addSlot(slots, toSlot(raw));
    }
  }

  for (const encounter of encounters.values()) {
    for (const [game, slots] of Object.entries(encounter.games)) {
      encounter.games[game as GameId] = collapseTimes(slots);
    }
  }

  return [...subAreas.values()]
    .map((area) => ({
      ...area,
      encounters: area.encounters.filter((e) => Object.keys(e.games).length > 0),
    }))
    .filter((area) => area.encounters.length > 0);
}

function toSlot(raw: RawSlot): EncounterSlot {
  return {
    levels: raw.levels,
    rate: raw.rate,
    ...(raw.conditions?.length ? { conditions: raw.conditions } : {}),
    ...(raw.ivs ? { ivs: raw.ivs } : {}),
    ...(raw.shiny ? { shiny: raw.shiny } : {}),
    ...(raw.note ? { note: raw.note } : {}),
  };
}

function conditionsKey(conditions: readonly EncounterCondition[] | undefined): string {
  return JSON.stringify(conditions ?? []);
}

function addSlot(slots: EncounterSlot[], slot: EncounterSlot): void {
  const key = conditionsKey(slot.conditions);
  const same =
    slot.rate.kind === 'percent'
      ? slots.find((s) => s.rate.kind === 'percent' && conditionsKey(s.conditions) === key)
      : undefined;
  if (!same || same.rate.kind !== 'percent' || slot.rate.kind !== 'percent') {
    slots.push(slot);
    return;
  }
  same.levels = unionLevels(same.levels, slot.levels);
  same.rate = {
    kind: 'percent',
    value: Math.round((same.rate.value + slot.rate.value) * 100) / 100,
  };
  if (slot.note && slot.note !== same.note) {
    same.note = same.note ? `${same.note} ${slot.note}` : slot.note;
  }
}

const TIMES = ['morning', 'day', 'night'] as const;

/** Merges a morning/day/night triple that only differs by its time condition into one untimed slot. */
function collapseTimes(slots: EncounterSlot[]): EncounterSlot[] {
  const timeOf = (slot: EncounterSlot) => slot.conditions?.find((c) => c.kind === 'time')?.value;
  const restKey = (slot: EncounterSlot) =>
    JSON.stringify([
      (slot.conditions ?? []).filter((c) => c.kind !== 'time'),
      slot.levels,
      slot.rate,
      slot.note,
    ]);
  const groups = new Map<string, EncounterSlot[]>();
  for (const slot of slots) {
    if (!timeOf(slot)) continue;
    const key = restKey(slot);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  const out: EncounterSlot[] = [];
  const done = new Set<string>();
  for (const slot of slots) {
    const time = timeOf(slot);
    const group = time ? groups.get(restKey(slot)) : undefined;
    const full =
      group?.length === TIMES.length && TIMES.every((t) => group.some((s) => timeOf(s) === t));
    if (!full) {
      out.push(slot);
      continue;
    }
    const key = restKey(slot);
    if (done.has(key)) continue;
    done.add(key);
    const conditions = (slot.conditions ?? []).filter((c) => c.kind !== 'time');
    const collapsed: EncounterSlot = { ...slot };
    delete collapsed.conditions;
    out.push(conditions.length ? { ...collapsed, conditions } : collapsed);
  }
  return out;
}
