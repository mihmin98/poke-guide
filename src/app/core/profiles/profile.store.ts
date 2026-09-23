import { Injectable, computed, inject, signal } from '@angular/core';
import type { GameId, Profile } from '../domain/models';
import {
  normalizeCaught,
  validProfileName,
  PROFILE_NAME_MAX,
  type PersistedState,
} from '../domain/persisted-state';
import { findGame } from '../games/registry';
import { StorageService } from '../storage/storage.service';

export const UNDO_LIMIT = 20;
const NO_ITEMS: ReadonlySet<number> = new Set();

/** The part of the state profile changes touch (and undo restores). */
interface ProfilesSnapshot {
  profiles: Profile[];
  activeProfileId: string | null;
}

export interface UndoEntry {
  /** "Marked Pidgey as caught", shown in the undo snackbar. */
  label: string;
  before: ProfilesSnapshot;
  after: ProfilesSnapshot;
}

/** What an import carries (plan §12.2): no id or timestamps. */
export interface ImportedProfile {
  name: string;
  game: GameId;
  caught: readonly number[];
  /** Absent for a `PKG1` code, which means "no items taken". */
  itemsTaken?: readonly number[];
  progressPart?: number;
}

export class ProfileError extends Error {
  override name = 'ProfileError';
}

/**
 * Profiles, catch status and picked-up items (plan §11.4, Phase 9), stored through `StorageService`. Catch
 * and item changes take the game shown in the URL and only apply when the active profile is for that game
 * (plan §11.3).
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly storage = inject(StorageService);
  private readonly history = signal<readonly UndoEntry[]>([]);

  readonly profiles = computed(() => this.storage.state().profiles);
  readonly activeProfileId = computed(() => this.storage.state().activeProfileId);
  readonly activeProfile = computed(() =>
    this.profiles().find((p) => p.id === this.activeProfileId()),
  );
  readonly caughtSet = computed<ReadonlySet<number>>(
    () => new Set(this.activeProfile()?.caught ?? []),
  );
  /** `LocationItem.no` values the active profile has picked up. */
  readonly itemsTakenSet = computed<ReadonlySet<number>>(
    () => new Set(this.activeProfile()?.itemsTaken ?? []),
  );
  /** The most recent undoable change, while it is still valid. */
  readonly lastChange = computed(() => {
    const entry = this.history().at(-1);
    return entry && this.isCurrent(entry) ? entry : undefined;
  });

  /**
   * The active profile's items taken, when it is for `game`. Unlike National Dex numbers, item numbers
   * only mean something within the profile's own game data, so other games see none.
   */
  itemsTakenIn(game: GameId): ReadonlySet<number> {
    return this.activeProfile()?.game === game ? this.itemsTakenSet() : NO_ITEMS;
  }

  isCaught(dex: number): boolean {
    return this.caughtSet().has(dex);
  }

  /** Whether catch changes for `game` would apply to the active profile. */
  canEditCatches(game: GameId): boolean {
    const profile = this.activeProfile();
    return !!profile && profile.game === game && !!findGame(profile.game);
  }

  /** `false` (and no change) when the active profile isn't for `game` or `dex` is out of range. */
  toggleCaught(game: GameId, dex: number, label?: string): boolean {
    return this.setCaught(game, dex, !this.isCaught(dex), label);
  }

  setCaught(game: GameId, dex: number, caught: boolean, label?: string): boolean {
    return this.bulkSetCaught(
      game,
      [dex],
      caught,
      label ?? `Marked #${dex} as ${caught ? 'caught' : 'not caught'}`,
    );
  }

  bulkSetCaught(game: GameId, dexes: readonly number[], caught: boolean, label?: string): boolean {
    const profile = this.activeProfile();
    const max = findGame(game)?.nationalDexMax ?? 0;
    if (
      !profile ||
      !this.canEditCatches(game) ||
      dexes.some((d) => !Number.isInteger(d) || d < 1 || d > max)
    ) {
      return false;
    }
    const set = new Set(profile.caught);
    for (const dex of dexes) {
      if (caught) set.add(dex);
      else set.delete(dex);
    }
    if (
      set.size === profile.caught.length &&
      dexes.every((d) => profile.caught.includes(d) === caught)
    )
      return true;
    const changed = dexes.filter((d) => profile.caught.includes(d) !== caught).length;
    this.change(
      label ?? `Marked ${dexes.length} Pokémon as ${caught ? 'caught' : 'not caught'}`,
      (s) =>
        this.countTowardsReminder(
          this.withProfile(s, profile.id, { caught: normalizeCaught([...set]) }),
          changed,
        ),
    );
    return true;
  }

  /**
   * Marks items (by `LocationItem.no`) as picked up or not. The same rules as catches apply; items never
   * count as caught, but they do count towards the save reminder and can be undone.
   */
  bulkSetItemsTaken(game: GameId, nos: readonly number[], taken: boolean, label: string): boolean {
    const profile = this.activeProfile();
    if (!profile || !this.canEditCatches(game) || nos.some((n) => !Number.isInteger(n) || n < 1))
      return false;
    const changed = nos.filter((n) => profile.itemsTaken.includes(n) !== taken);
    if (changed.length === 0) return true;
    const set = new Set(profile.itemsTaken);
    for (const no of changed) {
      if (taken) set.add(no);
      else set.delete(no);
    }
    this.change(label, (s) =>
      this.countTowardsReminder(
        this.withProfile(s, profile.id, { itemsTaken: normalizeCaught([...set]) }),
        changed.length,
      ),
    );
    return true;
  }

  setItemTaken(game: GameId, no: number, taken: boolean, label: string): boolean {
    return this.bulkSetItemsTaken(game, [no], taken, label);
  }

  /** Creates a profile, makes it active, and asks for persistent storage when it is the first one. */
  createProfile(name: string, game: GameId): Profile {
    const profile = this.newProfile(this.requireName(name), this.requireGame(game), []);
    const first = this.profiles().length === 0;
    this.change(`Created ${profile.name}`, (s) => ({
      ...s,
      profiles: [...s.profiles, profile],
      activeProfileId: profile.id,
    }));
    if (first) void this.storage.requestPersistence();
    return profile;
  }

  renameProfile(id: string, name: string): void {
    const valid = this.requireName(name);
    this.requireProfile(id);
    this.change(`Renamed profile to ${valid}`, (s) => this.withProfile(s, id, { name: valid }));
  }

  /** Deletes a profile; if it was active, the first remaining profile becomes active. */
  deleteProfile(id: string): void {
    const profile = this.requireProfile(id);
    this.change(`Deleted ${profile.name}`, (s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      const activeProfileId =
        s.activeProfileId === id ? (profiles[0]?.id ?? null) : s.activeProfileId;
      return { ...s, profiles, activeProfileId };
    });
  }

  /** Copies a profile as "<name> (copy)" right after the original, and makes the copy active. */
  duplicateProfile(id: string): Profile {
    const source = this.requireProfile(id);
    const suffix = ' (copy)';
    const name = source.name.slice(0, PROFILE_NAME_MAX - suffix.length).trimEnd() + suffix;
    const copy = this.newProfile(
      name,
      source.game,
      source.caught,
      source.progressPart,
      source.itemsTaken,
    );
    this.change(`Duplicated ${source.name}`, (s) => {
      const profiles = [...s.profiles];
      profiles.splice(profiles.findIndex((p) => p.id === id) + 1, 0, copy);
      return { ...s, profiles, activeProfileId: copy.id };
    });
    return copy;
  }

  setActive(id: string): void {
    const profile = this.requireProfile(id);
    if (this.activeProfileId() === id) return;
    this.change(`Switched to ${profile.name}`, (s) => ({ ...s, activeProfileId: id }));
  }

  /** "I'm at walkthrough part N" for the active profile; `undefined` clears it. */
  setProgressPart(part: number | undefined): void {
    const profile = this.activeProfile();
    if (!profile) throw new ProfileError('No active profile');
    if (part !== undefined && (!Number.isInteger(part) || part < 1))
      throw new ProfileError(`Invalid part ${part}`);
    this.change(`Set progress for ${profile.name}`, (s) =>
      this.withProfile(s, profile.id, { progressPart: part }),
    );
  }

  /**
   * `new` adds the imported profile (and makes it active); `replace` overwrites the caught list, the items
   * taken and the progress of `targetId`, which must be for the same game. Returns the affected profile's id.
   */
  importProfile(imported: ImportedProfile, mode: 'new' | 'replace', targetId?: string): string {
    const game = this.requireGame(imported.game);
    const max = findGame(game)!.nationalDexMax;
    const caught = normalizeCaught(imported.caught).filter((d) => d <= max);
    const itemsTaken = normalizeCaught(imported.itemsTaken ?? []);
    if (mode === 'new') {
      const name = validProfileName(imported.name) ?? 'Imported profile';
      const profile = this.newProfile(name, game, caught, imported.progressPart, itemsTaken);
      this.change(`Imported ${profile.name}`, (s) => ({
        ...s,
        profiles: [...s.profiles, profile],
        activeProfileId: profile.id,
      }));
      return profile.id;
    }
    const target = this.requireProfile(targetId ?? '');
    if (target.game !== game)
      throw new ProfileError(`Cannot replace a ${target.game} profile with ${game} data`);
    this.change(`Replaced ${target.name} with imported data`, (s) =>
      this.withProfile(s, target.id, { caught, itemsTaken, progressPart: imported.progressPart }),
    );
    return target.id;
  }

  /**
   * Counts catch changes towards the save reminder (plan §13.8). It lives in the settings, not in the
   * undo snapshot, so undoing a change does not make the reminder go away.
   */
  private countTowardsReminder(state: PersistedState, changes: number): PersistedState {
    if (changes <= 0) return state;
    return {
      ...state,
      settings: {
        ...state.settings,
        changesSinceExport: state.settings.changesSinceExport + changes,
      },
    };
  }

  /** Reverts the most recent change. Returns its entry, or `undefined` when there is nothing valid to undo. */
  undo(): UndoEntry | undefined {
    const entry = this.lastChange();
    if (!entry) {
      this.history.set([]);
      return undefined;
    }
    this.history.update((h) => h.slice(0, -1));
    this.storage.update((s) => ({ ...s, ...entry.before }));
    return entry;
  }

  private change(label: string, apply: (state: PersistedState) => PersistedState): void {
    const before = this.snapshot(this.storage.state());
    // Entries chain (each `before` is the previous `after`), so only the newest needs to match the current state.
    const last = this.history().at(-1);
    if (last && !this.isCurrentSnapshot(last.after, before)) this.history.set([]);
    this.storage.update(apply);
    const after = this.snapshot(this.storage.state());
    this.history.update((h) => [...h.slice(-(UNDO_LIMIT - 1)), { label, before, after }]);
  }

  /** An entry is only undoable while nothing else (another tab, a reload) has changed the profiles since. */
  private isCurrent(entry: UndoEntry): boolean {
    return this.isCurrentSnapshot(entry.after, this.snapshot(this.storage.state()));
  }

  private isCurrentSnapshot(a: ProfilesSnapshot, b: ProfilesSnapshot): boolean {
    return a.profiles === b.profiles && a.activeProfileId === b.activeProfileId;
  }

  private snapshot(state: PersistedState): ProfilesSnapshot {
    return { profiles: state.profiles, activeProfileId: state.activeProfileId };
  }

  private withProfile(state: PersistedState, id: string, patch: Partial<Profile>): PersistedState {
    const updatedAt = new Date().toISOString();
    const profiles = state.profiles.map((p) => {
      if (p.id !== id) return p;
      const next: Profile = { ...p, ...patch, updatedAt };
      if (next.progressPart === undefined) delete next.progressPart;
      return next;
    });
    return { ...state, profiles };
  }

  private newProfile(
    name: string,
    game: GameId,
    caught: readonly number[],
    progressPart?: number,
    itemsTaken: readonly number[] = [],
  ): Profile {
    const now = new Date().toISOString();
    const profile: Profile = {
      id: globalThis.crypto.randomUUID(),
      name,
      game,
      caught: [...caught],
      itemsTaken: [...itemsTaken],
      createdAt: now,
      updatedAt: now,
    };
    if (progressPart !== undefined && Number.isInteger(progressPart) && progressPart > 0)
      profile.progressPart = progressPart;
    return profile;
  }

  private requireName(name: string): string {
    const valid = validProfileName(name);
    if (!valid) throw new ProfileError(`Profile names must be 1–${PROFILE_NAME_MAX} characters`);
    return valid;
  }

  private requireGame(game: GameId): GameId {
    if (!findGame(game)) throw new ProfileError(`Unknown game ${game}`);
    return game;
  }

  private requireProfile(id: string): Profile {
    const profile = this.profiles().find((p) => p.id === id);
    if (!profile) throw new ProfileError(`No profile ${id}`);
    return profile;
  }
}
