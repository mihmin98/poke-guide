import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { migrateState } from '../domain/migrations';
import { defaultState, type PersistedState } from '../domain/persisted-state';

export const STATE_KEY = 'poke-guide/state';
export const CORRUPT_BACKUP_PREFIX = `${STATE_KEY}.corrupt.`;
export const SAVE_DEBOUNCE_MS = 300;
/** How many `state.corrupt.<ms>` backups to keep (plan §11.5). */
export const MAX_BACKUPS = 3;

/** `localStorage`, or `null` where reading it throws (blocked storage, some private modes). */
export const STATE_STORAGE = new InjectionToken<Storage | null>('STATE_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

export interface StorageRecovery {
  /** `newer`: saved by a newer app version. Either way the original text is kept under `backupKey`. */
  reason: 'invalid' | 'newer';
  message: string;
  /** `null` when the backup itself couldn't be written. */
  backupKey: string | null;
}

/**
 * The single writer of `poke-guide/state` (plan §11.4). Holds the state as a signal; `update` writes are
 * debounced and flushed when the page is hidden or closed, and changes from other tabs replace the state.
 * Storage errors never throw: they surface through `saveError` and `recovery`.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storage = inject(STATE_STORAGE);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly now = () => new Date().toISOString();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private persistRequested = false;

  private readonly stateSignal = signal<PersistedState>(defaultState());
  readonly state = this.stateSignal.asReadonly();
  /** Set when stored data couldn't be read at startup (or from another tab); the UI offers the backup. */
  readonly recovery = signal<StorageRecovery | null>(null);
  /** The last write error (quota, blocked storage); cleared by the next successful write. */
  readonly saveError = signal<unknown>(null);
  /** `false` when there is no usable storage: state lives in memory for this session only. */
  readonly available = this.storage !== null;

  constructor() {
    this.stateSignal.set(this.load());
    const onStorage = (event: StorageEvent) => this.onStorageEvent(event);
    const onHidden = () => {
      if (this.window?.document.visibilityState === 'hidden') this.flush();
    };
    const onPageHide = () => this.flush();
    this.window?.addEventListener('storage', onStorage);
    this.window?.document.addEventListener('visibilitychange', onHidden);
    this.window?.addEventListener('pagehide', onPageHide);
    inject(DestroyRef).onDestroy(() => {
      this.flush();
      this.window?.removeEventListener('storage', onStorage);
      this.window?.document.removeEventListener('visibilitychange', onHidden);
      this.window?.removeEventListener('pagehide', onPageHide);
    });
  }

  /** Replaces the state and schedules a debounced write. */
  update(change: (state: PersistedState) => PersistedState): void {
    this.stateSignal.update(change);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
  }

  /** Writes a pending change now. */
  flush(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.storage) return;
    try {
      this.storage.setItem(STATE_KEY, JSON.stringify(this.stateSignal()));
      this.saveError.set(null);
    } catch (error) {
      this.saveError.set(error);
    }
  }

  /** Asks the browser not to evict storage (plan §11.4: when the first profile is created). Once per session. */
  async requestPersistence(): Promise<boolean> {
    if (this.persistRequested) return false;
    this.persistRequested = true;
    try {
      return (await this.window?.navigator.storage?.persist?.()) ?? false;
    } catch {
      return false;
    }
  }

  private load(): PersistedState {
    let text: string | null;
    try {
      text = this.storage?.getItem(STATE_KEY) ?? null;
    } catch {
      return defaultState();
    }
    if (text === null) return defaultState();
    return this.parse(text) ?? defaultState();
  }

  /** The migrated state, or `null` after backing up unreadable text and setting `recovery`. */
  private parse(text: string): PersistedState | null {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      this.recover(text, 'invalid', `Stored state is not valid JSON: ${String(error)}`);
      return null;
    }
    const result = migrateState(raw, this.now());
    if (result.ok) return result.state;
    this.recover(text, result.reason, result.message);
    return null;
  }

  private recover(text: string, reason: StorageRecovery['reason'], message: string): void {
    let backupKey: string | null = `${CORRUPT_BACKUP_PREFIX}${Date.now()}`;
    try {
      this.storage?.setItem(backupKey, text);
    } catch {
      backupKey = null;
    }
    if (backupKey !== null) this.pruneBackups(backupKey);
    this.recovery.set({ reason, message, backupKey });
  }

  /**
   * Keeps only the newest `MAX_BACKUPS` recovery backups. An app that keeps opening state it cannot
   * read would otherwise write a new `state.corrupt.<ms>` key on every load until storage is full.
   */
  private pruneBackups(keep: string): void {
    try {
      const storage = this.storage;
      if (!storage) return;
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(CORRUPT_BACKUP_PREFIX)) keys.push(key);
      }
      // Timestamps are fixed-width for the next ~270 years, so a plain sort is chronological.
      keys.sort();
      for (const key of keys.slice(0, -MAX_BACKUPS)) if (key !== keep) storage.removeItem(key);
    } catch {
      // Pruning is best effort: a failure here must not lose the backup we just wrote.
    }
  }

  private onStorageEvent(event: StorageEvent): void {
    if (event.key !== STATE_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== this.storage) return;
    // `key === null` means another tab cleared storage.
    const text = event.key === null ? null : event.newValue;
    const next = text === null ? defaultState() : this.parse(text);
    if (!next) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.stateSignal.set(next);
  }
}
