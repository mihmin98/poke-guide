// FRAMEWORK-FREE: persisted-state migrations (plan §11.5). No Angular imports.
import { STATE_SCHEMA_VERSION, sanitizeState, type PersistedState } from './persisted-state';

/**
 * `MIGRATIONS[n]` turns a schema `n + 1` object into schema `n + 2`; they run in order on load.
 * Append only: never edit or remove a released migration. Each one needs a snapshot test.
 */
export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: readonly Migration[] = [
  // 1 → 2 (Phase 9): profiles gain `itemsTaken`. The bump stops an older app from overwriting the ticks.
  (state) => ({
    ...state,
    profiles: Array.isArray(state['profiles'])
      ? state['profiles'].map((profile: unknown) =>
          typeof profile === 'object' && profile !== null
            ? { itemsTaken: [], ...profile }
            : profile,
        )
      : state['profiles'],
  }),
  // 2 → 3 (Phase 11): profiles gain `milestonesDone`, for the same reason.
  (state) => ({
    ...state,
    profiles: Array.isArray(state['profiles'])
      ? state['profiles'].map((profile: unknown) =>
          typeof profile === 'object' && profile !== null
            ? { milestonesDone: [], ...profile }
            : profile,
        )
      : state['profiles'],
  }),
];

export type MigrationResult =
  | { ok: true; state: PersistedState; migratedFrom?: number }
  /** `newer`: written by a newer app version; it must not be overwritten. */
  | { ok: false; reason: 'invalid' | 'newer'; message: string };

export function migrateState(
  raw: unknown,
  now: string,
  migrations: readonly Migration[] = MIGRATIONS,
  currentVersion: number = migrations.length + 1,
): MigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid', message: 'Stored state is not an object' };
  }
  let state = raw as Record<string, unknown>;
  const version = state['schemaVersion'];
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { ok: false, reason: 'invalid', message: `Unknown schemaVersion ${String(version)}` };
  }
  const from = version as number;
  if (from > currentVersion) {
    return {
      ok: false,
      reason: 'newer',
      message: `schemaVersion ${from} is newer than ${currentVersion}`,
    };
  }
  try {
    for (let v = from; v < currentVersion; v++)
      state = { ...migrations[v - 1]!(state), schemaVersion: v + 1 };
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid',
      message: `Migration from schemaVersion ${from} failed: ${String(error)}`,
    };
  }
  const result: MigrationResult = { ok: true, state: sanitizeState(state, now) };
  if (from < currentVersion) result.migratedFrom = from;
  return result;
}

// Keeps the constant and the migration list in step at compile time and in tests.
export const CURRENT_STATE_VERSION: typeof STATE_SCHEMA_VERSION = STATE_SCHEMA_VERSION;
