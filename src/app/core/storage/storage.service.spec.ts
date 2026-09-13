import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, defaultState, type PersistedState } from '../domain/persisted-state';
import { CORRUPT_BACKUP_PREFIX, SAVE_DEBOUNCE_MS, STATE_KEY, STATE_STORAGE, StorageService } from './storage.service';

class MemoryStorage implements Storage {
  readonly items = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.items.set(key, value);
  }
}

const profile = { id: 'p1', name: 'Red run', game: 'red' as const, caught: [1], createdAt: 't', updatedAt: 't' };
const saved: PersistedState = { ...defaultState(), activeProfileId: 'p1', profiles: [profile] };

describe('StorageService', () => {
  let storage: MemoryStorage | null;

  function create(): StorageService {
    TestBed.configureTestingModule({ providers: [{ provide: STATE_STORAGE, useValue: storage }] });
    return TestBed.inject(StorageService);
  }

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('starts from the default state when nothing is stored', () => {
    const service = create();
    expect(service.state()).toEqual(defaultState());
    expect(service.recovery()).toBeNull();
    expect(storage!.items.size).toBe(0);
  });

  it('loads and migrates stored state', () => {
    storage!.setItem(STATE_KEY, JSON.stringify({ ...saved, settings: { theme: 'dark' } }));
    const service = create();
    expect(service.state()).toEqual({ ...saved, settings: { ...DEFAULT_SETTINGS, theme: 'dark' } });
  });

  it.each([
    ['invalid JSON', '{not json', 'invalid'],
    ['a newer schema', JSON.stringify({ ...saved, schemaVersion: 99 }), 'newer'],
  ])('backs up %s, starts fresh and reports it', (_, text, reason) => {
    vi.setSystemTime(1_000);
    storage!.setItem(STATE_KEY, text);
    const service = create();
    expect(service.state()).toEqual(defaultState());
    expect(service.recovery()).toMatchObject({ reason, backupKey: `${CORRUPT_BACKUP_PREFIX}1000` });
    expect(storage!.getItem(`${CORRUPT_BACKUP_PREFIX}1000`)).toBe(text);
    expect(storage!.getItem(STATE_KEY)).toBe(text); // untouched until the next change
  });

  it('debounces writes', () => {
    const service = create();
    service.update((s) => ({ ...s, profiles: [profile] }));
    service.update((s) => ({ ...s, activeProfileId: 'p1' }));
    expect(service.state()).toEqual(saved);
    expect(storage!.getItem(STATE_KEY)).toBeNull();

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(storage!.getItem(STATE_KEY)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(JSON.parse(storage!.getItem(STATE_KEY)!)).toEqual(saved);
  });

  it('flushes a pending write when the page is hidden or closed', () => {
    const service = create();
    service.update((s) => ({ ...s, profiles: [profile] }));
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(storage!.getItem(STATE_KEY)!).profiles).toEqual([profile]);

    service.update((s) => ({ ...s, activeProfileId: 'p1' }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(JSON.parse(storage!.getItem(STATE_KEY)!)).toEqual(saved);
  });

  it('reports write errors without throwing, and clears them on success', () => {
    const service = create();
    storage!.failWrites = true;
    service.update((s) => ({ ...s, profiles: [profile] }));
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(service.saveError()).toBeInstanceOf(DOMException);
    expect(service.state().profiles).toEqual([profile]);

    storage!.failWrites = false;
    service.update((s) => ({ ...s, activeProfileId: 'p1' }));
    service.flush();
    expect(service.saveError()).toBeNull();
  });

  it('keeps working in memory without storage', () => {
    storage = null;
    const service = create();
    expect(service.available).toBe(false);
    service.update((s) => ({ ...s, profiles: [profile] }));
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(service.state().profiles).toEqual([profile]);
  });

  describe('cross-tab sync', () => {
    const storageEvent = (key: string | null, newValue: string | null) =>
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }));

    it('replaces the state with another tab’s change and drops the pending local write', () => {
      const service = create();
      service.update((s) => ({ ...s, settings: { ...s.settings, compactRows: true } }));
      storageEvent(STATE_KEY, JSON.stringify(saved));
      expect(service.state()).toEqual(saved);
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      expect(storage!.getItem(STATE_KEY)).toBeNull();
    });

    it('ignores other keys and unreadable values, and resets when storage is cleared', () => {
      storage!.setItem(STATE_KEY, JSON.stringify(saved));
      const service = create();
      storageEvent('other', JSON.stringify(defaultState()));
      expect(service.state()).toEqual(saved);
      storageEvent(STATE_KEY, '{broken');
      expect(service.state()).toEqual(saved);
      expect(service.recovery()?.reason).toBe('invalid');
      storageEvent(null, null);
      expect(service.state()).toEqual(defaultState());
    });
  });

  it('requests persistent storage once', async () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    const service = create();
    await expect(service.requestPersistence()).resolves.toBe(true);
    await expect(service.requestPersistence()).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
