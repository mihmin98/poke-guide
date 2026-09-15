// FRAMEWORK-FREE: the JSON backup of every profile (plan §12.3). No Angular imports.
import { STATE_SCHEMA_VERSION, sanitizeProfile } from './persisted-state';
import type { Profile } from './models';

export const BACKUP_APP_ID = 'poke-guide';

export interface ProfileBackup {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  profiles: Profile[];
}

export type BackupErrorKind = 'bad-json' | 'not-a-backup' | 'newer-schema' | 'no-profiles';

const BACKUP_ERRORS: Record<BackupErrorKind, string> = {
  'bad-json': 'That file isn’t valid JSON.',
  'not-a-backup': 'That file isn’t a Poké Guide backup.',
  'newer-schema': 'That backup was made by a newer version of Poké Guide.',
  'no-profiles': 'That backup holds no profiles that could be read.',
};

export type BackupResult =
  | { ok: true; value: ProfileBackup }
  | { ok: false; error: { kind: BackupErrorKind; message: string } };

export function buildBackup(profiles: readonly Profile[], now = new Date()): ProfileBackup {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: STATE_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    profiles: profiles.map((profile) => ({ ...profile })),
  };
}

/**
 * Reads a backup file. The contents are untrusted, so every profile goes through the same
 * sanitizer the stored state uses, and unreadable ones are dropped rather than failing the import.
 */
export function parseBackup(text: string, now = new Date().toISOString()): BackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: 'bad-json', message: BACKUP_ERRORS['bad-json'] } };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: { kind: 'not-a-backup', message: BACKUP_ERRORS['not-a-backup'] } };
  }
  const file = raw as Record<string, unknown>;
  if (file['app'] !== BACKUP_APP_ID || !Array.isArray(file['profiles'])) {
    return { ok: false, error: { kind: 'not-a-backup', message: BACKUP_ERRORS['not-a-backup'] } };
  }
  const schemaVersion = file['schemaVersion'];
  if (typeof schemaVersion !== 'number' || schemaVersion > STATE_SCHEMA_VERSION) {
    return { ok: false, error: { kind: 'newer-schema', message: BACKUP_ERRORS['newer-schema'] } };
  }

  const profiles = file['profiles']
    .map((profile) => sanitizeProfile(profile, now))
    .filter((profile): profile is Profile => profile !== null);
  if (profiles.length === 0) {
    return { ok: false, error: { kind: 'no-profiles', message: BACKUP_ERRORS['no-profiles'] } };
  }

  return {
    ok: true,
    value: {
      app: BACKUP_APP_ID,
      schemaVersion,
      exportedAt: typeof file['exportedAt'] === 'string' ? file['exportedAt'] : '',
      profiles,
    },
  };
}
