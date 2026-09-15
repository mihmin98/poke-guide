import { Injectable, computed, inject } from '@angular/core';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../domain/persisted-state';
import { StorageService } from '../storage/storage.service';

/** Global settings (plan §11.4), stored through `StorageService`. Not exported with profiles. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(StorageService);

  readonly settings = computed(() => this.storage.state().settings);

  /** One setting as a signal. */
  select<K extends keyof Settings>(key: K) {
    return computed(() => this.settings()[key]);
  }

  /** Invalid values (e.g. from a URL or an old form) fall back to the default for that field. */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.settings()[key] === value) return;
    this.storage.update((s) => ({
      ...s,
      settings: sanitizeSettings({ ...s.settings, [key]: value }),
    }));
  }

  reset(): void {
    this.storage.update((s) => ({ ...s, settings: { ...DEFAULT_SETTINGS } }));
  }
}
