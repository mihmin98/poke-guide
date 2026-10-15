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

/** Schema 2 (Phase 9): profiles carry the item numbers they have picked up. */
const v2Snapshot = {
  ...v1Snapshot,
  schemaVersion: 2,
  profiles: [
    { ...v1Snapshot.profiles[0]!, itemsTaken: [3, 17] },
    { ...v1Snapshot.profiles[1]!, itemsTaken: [] },
  ],
};

/** Schema 3 (Phase 11): profiles carry the story milestone numbers they have done. */
const v3Snapshot = {
  ...v2Snapshot,
  schemaVersion: 3,
  profiles: [
    { ...v2Snapshot.profiles[0]!, milestonesDone: [1, 6] },
    { ...v2Snapshot.profiles[1]!, milestonesDone: [] },
  ],
};

describe('migrateState', () => {
  it('matches the schema version constant', () => {
    expect(MIGRATIONS.length + 1).toBe(CURRENT_STATE_VERSION);
  });

  it('loads a current (v3) snapshot unchanged', () => {
    expect(migrateState(structuredClone(v3Snapshot), NOW)).toEqual({ ok: true, state: v3Snapshot });
  });

  it('migrates a v1 snapshot: every profile gains an empty itemsTaken and milestonesDone', () => {
    expect(migrateState(structuredClone(v1Snapshot), NOW)).toEqual({
      ok: true,
      migratedFrom: 1,
      state: {
        ...v1Snapshot,
        schemaVersion: 3,
        profiles: v1Snapshot.profiles.map((p) => ({ ...p, itemsTaken: [], milestonesDone: [] })),
      },
    });
    // The migration itself leaves anything that isn't a profile object to the sanitizer.
    expect(MIGRATIONS[0]!({ profiles: [{ id: 'a', itemsTaken: [5] }, 'junk'] })).toEqual({
      profiles: [{ id: 'a', itemsTaken: [5] }, 'junk'],
    });
    expect(MIGRATIONS[0]!({ profiles: 'junk' })).toEqual({ profiles: 'junk' });
  });

  it('migrates a v2 snapshot: every profile keeps its items and gains an empty milestonesDone', () => {
    expect(migrateState(structuredClone(v2Snapshot), NOW)).toEqual({
      ok: true,
      migratedFrom: 2,
      state: {
        ...v2Snapshot,
        schemaVersion: 3,
        profiles: v2Snapshot.profiles.map((p) => ({ ...p, milestonesDone: [] })),
      },
    });
    expect(MIGRATIONS[1]!({ profiles: [{ id: 'a', milestonesDone: [5] }, 'junk'] })).toEqual({
      profiles: [{ id: 'a', milestonesDone: [5] }, 'junk'],
    });
    expect(MIGRATIONS[1]!({ profiles: 'junk' })).toEqual({ profiles: 'junk' });
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
    expect(migrateState({ ...v3Snapshot, schemaVersion: 4 }, NOW)).toMatchObject({
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

  it('shows story steps in the guide unless turned off, also for settings saved before Phase 18', () => {
    expect(sanitizeSettings({ showRates: true }).guideShowStory).toBe(true);
    expect(sanitizeSettings({ guideShowStory: false }).guideShowStory).toBe(false);
    expect(sanitizeSettings({ guideShowStory: 'no' }).guideShowStory).toBe(true);
  });

  it('repairs profiles and drops those without an id or game', () => {
    expect(
      sanitizeProfile(
        {
          id: 'x',
          game: 'crystal-2',
          name: `  ${'a'.repeat(40)} `,
          caught: [3, 1, 3, 0, -2, 1.5, '7'],
          itemsTaken: [9, 2, 'x', 2],
          milestonesDone: [6, 1, 6, 'x'],
          progressPart: 0,
        },
        NOW,
      ),
    ).toEqual({
      id: 'x',
      game: 'crystal-2',
      name: 'a'.repeat(32),
      caught: [1, 3],
      itemsTaken: [2, 9],
      milestonesDone: [1, 6],
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
    expect(migrateState({ schemaVersion: 3, activeProfileId: 'gone' }, NOW)).toEqual({
      ok: true,
      state: defaultState(),
    });
  });
});
