// FRAMEWORK-FREE: the persisted app state (plan §11.5) and its sanitizer. No Angular imports.
import type { GameId, Profile } from './models';

export const STATE_SCHEMA_VERSION = 3;

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  showRates: boolean;
  showCatchRates: boolean;
  showEmptyLocations: boolean;
  /** Hides locations after the active profile's `progressPart`. */
  hideUnavailable: boolean;
  spriteScale: 2 | 3;
  compactRows: boolean;
  checklistSort: 'national' | 'regional' | 'walkthrough';
  /** Catch changes since the last export, for the save-reminder banner (plan §13.8). */
  changesSinceExport: number;
}

export interface PersistedState {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  activeProfileId: string | null;
  profiles: Profile[];
  /** Global; never exported with profiles. */
  settings: Settings;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: 'system',
  showRates: true,
  showCatchRates: true,
  showEmptyLocations: false,
  hideUnavailable: false,
  spriteScale: 2,
  compactRows: false,
  checklistSort: 'national',
  changesSinceExport: 0,
};

export function defaultState(): PersistedState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    activeProfileId: null,
    profiles: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const PROFILE_NAME_MAX = 32;

/** A trimmed profile name, or `null` when it is empty or longer than `PROFILE_NAME_MAX`. */
export function validProfileName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= PROFILE_NAME_MAX ? trimmed : null;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const count = (value: unknown, fallback: number) =>
  Number.isInteger(value) && (value as number) >= 0 ? (value as number) : fallback;

export function sanitizeSettings(raw: unknown): Settings {
  const s = isObject(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    theme: pick(s['theme'], ['system', 'light', 'dark'] as const, d.theme),
    showRates: bool(s['showRates'], d.showRates),
    showCatchRates: bool(s['showCatchRates'], d.showCatchRates),
    showEmptyLocations: bool(s['showEmptyLocations'], d.showEmptyLocations),
    hideUnavailable: bool(s['hideUnavailable'], d.hideUnavailable),
    spriteScale: pick(s['spriteScale'], [2, 3] as const, d.spriteScale),
    compactRows: bool(s['compactRows'], d.compactRows),
    checklistSort: pick(
      s['checklistSort'],
      ['national', 'regional', 'walkthrough'] as const,
      d.checklistSort,
    ),
    changesSinceExport: count(s['changesSinceExport'], d.changesSinceExport),
  };
}

/** Sorted, unique, positive integers: National Dex numbers, or item or milestone numbers. */
export function normalizeCaught(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const dexes = raw.filter((n): n is number => Number.isInteger(n) && n > 0);
  return [...new Set(dexes)].sort((a, b) => a - b);
}

/**
 * A profile read from storage, or `null` when it lacks an id or game. Games missing from the registry are
 * kept (shown as "unsupported game", plan §11.4); other fields are repaired rather than dropped.
 */
export function sanitizeProfile(raw: unknown, now: string): Profile | null {
  if (!isObject(raw)) return null;
  const { id, game, name, progressPart, createdAt, updatedAt } = raw;
  if (typeof id !== 'string' || id === '' || typeof game !== 'string' || game === '') return null;
  const profile: Profile = {
    id,
    name:
      (typeof name === 'string' ? name.trim() : '').slice(0, PROFILE_NAME_MAX) || 'Unnamed profile',
    game: game as GameId,
    caught: normalizeCaught(raw['caught']),
    // Numbers the current data doesn't know (a retired item) are kept, and simply not shown.
    itemsTaken: normalizeCaught(raw['itemsTaken']),
    // Likewise for milestone numbers (plan §7.14).
    milestonesDone: normalizeCaught(raw['milestonesDone']),
    createdAt: typeof createdAt === 'string' ? createdAt : now,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : now,
  };
  if (Number.isInteger(progressPart) && (progressPart as number) > 0)
    profile.progressPart = progressPart as number;
  return profile;
}

/** A current-schema state object with every field checked; duplicate profile ids keep the first. */
export function sanitizeState(raw: Json, now: string): PersistedState {
  const profiles: Profile[] = [];
  const ids = new Set<string>();
  for (const item of Array.isArray(raw['profiles']) ? raw['profiles'] : []) {
    const profile = sanitizeProfile(item, now);
    if (profile && !ids.has(profile.id)) {
      ids.add(profile.id);
      profiles.push(profile);
    }
  }
  const active = raw['activeProfileId'];
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    activeProfileId:
      typeof active === 'string' && ids.has(active) ? active : (profiles[0]?.id ?? null),
    profiles,
    settings: sanitizeSettings(raw['settings']),
  };
}
