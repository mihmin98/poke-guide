/**
 * Curated encounter overrides (plan §7.7): encounters that aren't in any table (statics, legendaries), patches to
 * parsed rows (method corrections, duplicates), exclusive groups and event-only species. Override rows and patches
 * work on walked rows before the merge, so they land in the same sub-areas as table rows.
 */
import type {
  EncounterCondition,
  EncounterMethodId,
  ExclusiveGroup,
  GameId,
  GameLocation,
  RequiresOtherGame,
  StatId,
  Unlock,
} from '../../../src/app/core/domain/models';
import type { WalkedRow } from './encounter-walker';
import type { SourceLookup } from './location-items';

export interface OverrideEncounter {
  locationId: string;
  dex: number;
  /** Species name, checked against the species list like table rows. */
  name: string;
  method: EncounterMethodId;
  games: GameId[];
  level: number;
  /** A floor or sub-area heading as used by the location's table (`B4F`). */
  subArea?: string;
  /** Unlock ids, all required. */
  requires?: string[];
  label?: string;
  note?: string;
  /** E.g. Union Cave's Lapras only appears on Fridays. */
  conditions?: EncounterCondition[];
  /** Fixed DVs/IVs, as the generation stores them (Gen II: `hp`, `atk`, `def`, `spe`, `spc`). */
  ivs?: Partial<Record<StatId, number>>;
  shiny?: 'locked' | 'guaranteed';
  /** Defaults to the location page; its revid is recorded. */
  sourcePage?: string;
  /** Why the override exists, with a pret or Bulbapedia link for the values. */
  reason: string;
}

export interface EncounterPatch {
  locationId: string;
  /** Rows to change; every given field must match. At least one row must match. */
  match: { method: EncounterMethodId; dex?: number; label?: string };
  /** `drop` removes the rows; `requires` replaces the rows' unlock ids. */
  set: { method?: EncounterMethodId; label?: string | null; requires?: string[] } | 'drop';
  sourcePage?: string;
  reason: string;
}

export interface ExclusiveGroupOverride extends ExclusiveGroup {
  /** Where the members' encounters are; each member must be found there for every game of the group. */
  locationIds: string[];
  methods: EncounterMethodId[];
}

export interface EncounterOverrides {
  encounters: readonly OverrideEncounter[];
  patches: readonly EncounterPatch[];
  exclusiveGroups: readonly ExclusiveGroupOverride[];
  eventOnly: readonly number[];
  /** Species that only come from other games (plan §9, `requires-other-game`), with the reason shown. */
  requiresOtherGame?: readonly RequiresOtherGame[];
}

/** Walked rows for a location's override encounters. */
export function overrideRows(
  locationId: string,
  pageTitle: string,
  overrides: EncounterOverrides,
  sourceOf: SourceLookup,
): WalkedRow[] {
  const rows: WalkedRow[] = [];
  for (const o of overrides.encounters) {
    if (o.locationId !== locationId || !sourceOf(o.sourcePage ?? pageTitle)) continue;
    rows.push({
      row: {
        dex: o.dex,
        name: o.name,
        rawMethod: o.method,
        games: [...o.games],
        slots: [
          {
            levels: { min: o.level, max: o.level },
            rawLevels: String(o.level),
            rate: { kind: 'once' },
            ...(o.conditions ? { conditions: [...o.conditions] } : {}),
            ...(o.ivs ? { ivs: { kind: 'fixed' as const, values: { ...o.ivs } } } : {}),
            ...(o.shiny ? { shiny: o.shiny } : {}),
            ...(o.note ? { note: o.note } : {}),
          },
        ],
        types: [],
      },
      method: o.method,
      requires: [...(o.requires ?? [])],
      subArea: o.subArea ?? null,
      label: o.label ?? null,
    });
  }
  return rows;
}

/** Applies a location's patches to its walked rows. Returns the rows and errors for patches that match nothing. */
export function applyEncounterPatches(
  locationId: string,
  pageTitle: string,
  rows: readonly WalkedRow[],
  overrides: EncounterOverrides,
  sourceOf: SourceLookup,
): { rows: WalkedRow[]; errors: string[] } {
  let result = [...rows];
  const errors: string[] = [];
  for (const patch of overrides.patches) {
    if (patch.locationId !== locationId) continue;
    const { method, dex, label } = patch.match;
    const matches = (r: WalkedRow) =>
      r.method === method &&
      (dex === undefined || r.row.dex === dex) &&
      (label === undefined || r.label === label);
    if (!result.some(matches)) {
      errors.push(
        `Encounter patch for ${JSON.stringify(patch.match)} in ${locationId} matches no rows`,
      );
      continue;
    }
    if (!sourceOf(patch.sourcePage ?? pageTitle)) continue;
    const set = patch.set;
    result =
      set === 'drop'
        ? result.filter((r) => !matches(r))
        : result.map((r) =>
            matches(r)
              ? {
                  ...r,
                  method: set.method ?? r.method,
                  label: set.label === undefined ? r.label : set.label,
                  requires: set.requires ? [...set.requires] : r.requires,
                }
              : r,
          );
  }
  return { rows: result, errors };
}

/** Errors for overrides and patches naming locations that aren't configured. */
export function checkOverrideLocations(
  overrides: EncounterOverrides,
  locationIds: ReadonlySet<string>,
): string[] {
  return [
    ...overrides.encounters.map((o) => [o.locationId, `#${o.dex} ${o.name}`] as const),
    ...overrides.patches.map((p) => [p.locationId, JSON.stringify(p.match)] as const),
    ...overrides.exclusiveGroups.flatMap((g) => g.locationIds.map((id) => [id, g.id] as const)),
  ]
    .filter(([id]) => !locationIds.has(id))
    .map(([id, what]) => `Encounter override ${what} names unknown location "${id}"`);
}

/** Tags member encounters with their exclusive group (in place). Errors for members missing in a game. */
export function applyExclusiveGroups(
  locations: GameLocation[],
  groups: readonly ExclusiveGroupOverride[],
): string[] {
  const errors: string[] = [];
  for (const group of groups) {
    const encounters = locations
      .filter((l) => group.locationIds.includes(l.id))
      .flatMap((l) => l.subAreas.flatMap((s) => s.encounters))
      .filter((e) => group.members.includes(e.dex) && group.methods.includes(e.method));
    for (const dex of group.members) {
      for (const game of group.games) {
        if (!encounters.some((e) => e.dex === dex && e.games[game]))
          errors.push(`Exclusive group ${group.id}: no encounter for #${dex} in ${game}`);
      }
    }
    for (const encounter of encounters) {
      if (group.games.some((g) => encounter.games[g])) encounter.exclusiveGroupId = group.id;
    }
  }
  return errors;
}

/** Errors for encounter requirements that aren't unlocks in every game of the encounter. */
export function checkEncounterRequirements(
  locations: readonly GameLocation[],
  unlocks: Partial<Record<GameId, readonly Unlock[]>>,
): string[] {
  const errors: string[] = [];
  for (const location of locations) {
    for (const encounter of location.subAreas.flatMap((s) => s.encounters)) {
      for (const id of encounter.requires ?? []) {
        const missing = (Object.keys(encounter.games) as GameId[]).filter(
          (game) => !unlocks[game]?.some((u) => u.id === id),
        );
        if (missing.length > 0)
          errors.push(
            `#${encounter.dex} in ${location.id} requires "${id}", which is not an unlock in ${missing.join(', ')}`,
          );
      }
    }
  }
  return errors;
}
