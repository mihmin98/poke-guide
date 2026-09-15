import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, type Settings } from '../domain/persisted-state';
import { STATE_STORAGE, StorageService } from '../storage/storage.service';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let store: SettingsStore;
  let storage: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: STATE_STORAGE, useValue: null }] });
    store = TestBed.inject(SettingsStore);
    storage = TestBed.inject(StorageService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('starts with the defaults and updates single settings', () => {
    const theme = store.select('theme');
    expect(store.settings()).toEqual(DEFAULT_SETTINGS);
    store.set('theme', 'dark');
    store.set('spriteScale', 3);
    expect(theme()).toBe('dark');
    expect(storage.state().settings).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      spriteScale: 3,
    });
  });

  it('falls back to the default for invalid values and skips no-op writes', () => {
    store.set('theme', 'dark');
    store.set('theme', 'neon' as Settings['theme']);
    expect(store.settings().theme).toBe('system');

    const spy = vi.spyOn(storage, 'update');
    store.set('theme', 'system');
    expect(spy).not.toHaveBeenCalled();
  });

  it('resets to the defaults without touching profiles', () => {
    storage.update((s) => ({ ...s, activeProfileId: null, profiles: [] }));
    store.set('compactRows', true);
    const profiles = storage.state().profiles;
    store.reset();
    expect(store.settings()).toEqual(DEFAULT_SETTINGS);
    expect(storage.state().profiles).toBe(profiles);
  });
});
