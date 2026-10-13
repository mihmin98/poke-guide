import { buildBackup, parseBackup, BACKUP_APP_ID } from './backup';
import type { Profile } from './models';

const PROFILE: Profile = {
  id: 'a',
  name: 'Red run',
  game: 'red',
  caught: [1, 4, 7],
  itemsTaken: [3, 17],
  milestonesDone: [1, 6],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('profile backup file (plan §12.3)', () => {
  it('round-trips every profile', () => {
    const backup = buildBackup([PROFILE], new Date('2026-09-15T10:00:00Z'));
    expect(backup).toMatchObject({ app: BACKUP_APP_ID, schemaVersion: 3 });
    expect(backup.exportedAt).toBe('2026-09-15T10:00:00.000Z');

    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok && result.value.profiles).toEqual([PROFILE]);
  });

  it('repairs what it can and drops profiles it cannot read', () => {
    const file = JSON.stringify({
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      profiles: [{ id: 'a', game: 'red', caught: [3, 3, 1, -2, 'x'] }, { game: 'red' }, 'nonsense'],
    });
    const result = parseBackup(file, '2026-09-15T00:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profiles).toHaveLength(1);
    expect(result.value.profiles[0]).toMatchObject({
      id: 'a',
      name: 'Unnamed profile',
      caught: [1, 3],
      // A schema-1 backup predates item and milestone tracking.
      itemsTaken: [],
      milestonesDone: [],
    });
  });

  it('restores a schema-2 backup with its items and no milestones', () => {
    const v2Profile: Partial<Profile> = { ...PROFILE };
    delete v2Profile.milestonesDone;
    const file = JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: 2, profiles: [v2Profile] });
    const result = parseBackup(file);
    expect(result.ok && result.value.profiles).toEqual([{ ...PROFILE, milestonesDone: [] }]);
  });

  it('rejects files that are not backups', () => {
    expect(parseBackup('{')).toMatchObject({ error: { kind: 'bad-json' } });
    expect(parseBackup('[]')).toMatchObject({ error: { kind: 'not-a-backup' } });
    expect(parseBackup('{"app":"other","profiles":[]}')).toMatchObject({
      error: { kind: 'not-a-backup' },
    });
    expect(
      parseBackup(JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: 99, profiles: [PROFILE] })),
    ).toMatchObject({ error: { kind: 'newer-schema' } });
    expect(
      parseBackup(JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: 1, profiles: [] })),
    ).toMatchObject({ error: { kind: 'no-profiles' } });
  });
});
