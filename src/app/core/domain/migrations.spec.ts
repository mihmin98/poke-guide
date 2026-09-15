import { CURRENT_STATE_VERSION, MIGRATIONS, migrateState, type Migration } from './migrations';
import {
  DEFAULT_SETTINGS,
  defaultState,
  sanitizeProfile,
  sanitizeSettings,
} from './persisted-state';

const NOW = '2026-09-13T12:00:00.000Z';

const v1Snapshot = {
  schemaVersion: 1,
  activeProfileId: 'p2',
  profiles: [
    {
      id: 'p1',
      name: 'My Red run',
      game: 'red',
      caught: [1, 4, 25],
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
    {
      id: 'p2',
      name: 'Yellow',
      game: 'yellow',
      caught: [25],
      progressPart: 3,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    },
  ],
  settings: { ...DEFAULT_SETTINGS, theme: 'dark', spriteScale: 3 },
};

describe('migrateState', () => {
  it('matches the schema version constant', () => {
    expect(MIGRATIONS.length + 1).toBe(CURRENT_STATE_VERSION);
  });

  it('loads a current (v1) snapshot unchanged', () => {
    expect(migrateState(structuredClone(v1Snapshot), NOW)).toEqual({ ok: true, state: v1Snapshot });
  });

  it('runs migrations in order from the stored version and sanitizes the result', () => {
    const calls: number[] = [];
    const migrations: Migration[] = [
      (s) => (calls.push(1), { ...s, profiles: [], activeProfileId: null, settings: s['prefs'] }),
      (s) => (
        calls.push(2),
        { ...s, settings: { ...(s['settings'] as object), compactRows: true } }
      ),
    ];
    const result = migrateState({ schemaVersion: 1, prefs: { theme: 'light' } }, NOW, migrations);
    expect(calls).toEqual([1, 2]);
    expect(result).toEqual({
      ok: true,
      migratedFrom: 1,
      state: {
        ...defaultState(),
        settings: { ...DEFAULT_SETTINGS, theme: 'light', compactRows: true },
      },
    });

    calls.length = 0;
    expect(migrateState({ schemaVersion: 2 }, NOW, migrations)).toMatchObject({
      ok: true,
      migratedFrom: 2,
    });
    expect(calls).toEqual([2]);
  });

  it('refuses state from a newer app version and rejects unreadable input', () => {
    expect(migrateState({ ...v1Snapshot, schemaVersion: 2 }, NOW)).toMatchObject({
      ok: false,
      reason: 'newer',
    });
    for (const raw of [null, 'text', [1], {}, { schemaVersion: 0 }, { schemaVersion: '1' }]) {
      expect(migrateState(raw, NOW)).toMatchObject({ ok: false, reason: 'invalid' });
    }
    const throwing: Migration[] = [
      () => {
        throw new Error('boom');
      },
    ];
    expect(migrateState({ schemaVersion: 1 }, NOW, throwing)).toMatchObject({
      ok: false,
      reason: 'invalid',
      message: /boom/,
    });
  });
});

describe('sanitizing stored state', () => {
  it('repairs settings field by field', () => {
    expect(
      sanitizeSettings({
        theme: 'neon',
        showRates: false,
        spriteScale: 4,
        checklistSort: 'walkthrough',
        extra: 1,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      showRates: false,
      checklistSort: 'walkthrough',
    });
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('repairs profiles and drops those without an id or game', () => {
    expect(
      sanitizeProfile(
        {
          id: 'x',
          game: 'crystal-2',
          name: `  ${'a'.repeat(40)} `,
          caught: [3, 1, 3, 0, -2, 1.5, '7'],
          progressPart: 0,
        },
        NOW,
      ),
    ).toEqual({
      id: 'x',
      game: 'crystal-2',
      name: 'a'.repeat(32),
      caught: [1, 3],
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(sanitizeProfile({ id: 'x', game: 'red', name: '' }, NOW)?.name).toBe('Unnamed profile');
    expect(sanitizeProfile({ game: 'red' }, NOW)).toBeNull();
    expect(sanitizeProfile({ id: 'x' }, NOW)).toBeNull();
  });

  it('keeps the first of duplicate ids and repairs a dangling active profile', () => {
    const result = migrateState(
      {
        schemaVersion: 1,
        activeProfileId: 'gone',
        profiles: [{ id: 'a', game: 'red' }, { id: 'a', game: 'blue' }, 'junk'],
      },
      NOW,
    );
    expect(result.ok && result.state.profiles.map((p) => p.game)).toEqual(['red']);
    expect(result.ok && result.state.activeProfileId).toBe('a');
    expect(migrateState({ schemaVersion: 1, activeProfileId: 'gone' }, NOW)).toEqual({
      ok: true,
      state: defaultState(),
    });
  });
});
