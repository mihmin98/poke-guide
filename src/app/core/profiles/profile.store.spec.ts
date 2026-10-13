import { TestBed } from '@angular/core/testing';
import type { GameId, Profile } from '../domain/models';
import { STATE_STORAGE, StorageService } from '../storage/storage.service';
import { ProfileError, ProfileStore, UNDO_LIMIT } from './profile.store';

describe('ProfileStore', () => {
  let store: ProfileStore;
  let storage: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: STATE_STORAGE, useValue: null }] });
    store = TestBed.inject(ProfileStore);
    storage = TestBed.inject(StorageService);
  });

  afterEach(() => TestBed.resetTestingModule());

  const names = () => store.profiles().map((p) => p.name);

  describe('profiles', () => {
    it('creates profiles, makes the new one active and requests persistence once', () => {
      const persist = vi.spyOn(storage, 'requestPersistence').mockResolvedValue(true);
      const red = store.createProfile('  My Red run ', 'red');
      expect(red).toMatchObject({ name: 'My Red run', game: 'red', caught: [] });
      expect(store.activeProfile()).toEqual(red);
      store.createProfile('Yellow', 'yellow');
      expect(store.activeProfile()?.name).toBe('Yellow');
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it('validates names, games and ids', () => {
      expect(() => store.createProfile('   ', 'red')).toThrow(ProfileError);
      expect(() => store.createProfile('x'.repeat(33), 'red')).toThrow(/1–32/);
      expect(() => store.createProfile('Green', 'green' as GameId)).toThrow(/Unknown game/);
      expect(() => store.renameProfile('missing', 'Name')).toThrow(/No profile/);
    });

    it('renames, duplicates next to the original and switches', () => {
      const a = store.createProfile('A'.repeat(32), 'red');
      const b = store.createProfile('B', 'blue');
      store.setActive(a.id);
      store.setProgressPart(4);
      const copy = store.duplicateProfile(a.id);
      expect(names()).toEqual(['A'.repeat(32), `${'A'.repeat(25)} (copy)`, 'B']);
      expect(copy).toMatchObject({ game: 'red', progressPart: 4 });
      expect(copy.id).not.toBe(a.id);
      expect(store.activeProfileId()).toBe(copy.id);

      store.renameProfile(b.id, ' Blue run ');
      expect(names()[2]).toBe('Blue run');
    });

    it('deletes profiles and picks the first remaining one when the active one goes', () => {
      const a = store.createProfile('A', 'red');
      const b = store.createProfile('B', 'blue');
      store.deleteProfile(b.id);
      expect(store.activeProfileId()).toBe(a.id);
      store.deleteProfile(a.id);
      expect(store.activeProfile()).toBeUndefined();
    });

    it('sets and clears walkthrough progress on the active profile', () => {
      store.createProfile('A', 'red');
      store.setProgressPart(3);
      expect(store.activeProfile()?.progressPart).toBe(3);
      store.setProgressPart(undefined);
      expect(store.activeProfile()).not.toHaveProperty('progressPart');
      expect(() => store.setProgressPart(0)).toThrow(ProfileError);
    });
  });

  describe('catch status', () => {
    beforeEach(() => store.createProfile('Red run', 'red'));

    it('toggles and bulk-sets caught species on the active profile, sorted', () => {
      expect(store.toggleCaught('red', 25)).toBe(true);
      expect(store.bulkSetCaught('red', [4, 1, 25], true)).toBe(true);
      expect(store.activeProfile()?.caught).toEqual([1, 4, 25]);
      expect(store.isCaught(4)).toBe(true);
      store.toggleCaught('red', 4);
      store.setCaught('red', 1, false);
      expect(store.activeProfile()?.caught).toEqual([25]);
    });

    it('refuses changes for another game or out-of-range species', () => {
      expect(store.canEditCatches('blue')).toBe(false);
      expect(store.toggleCaught('blue', 25)).toBe(false);
      expect(store.bulkSetCaught('red', [1, 152], true)).toBe(false);
      expect(store.setCaught('red', 0, true)).toBe(false);
      expect(store.activeProfile()?.caught).toEqual([]);
    });

    it('does not record a change when nothing changes', () => {
      store.setCaught('red', 7, true);
      const before = store.profiles();
      expect(store.setCaught('red', 7, true)).toBe(true);
      expect(store.profiles()).toBe(before);
    });

    it('keeps unsupported-game profiles but refuses edits', () => {
      const unsupported: Profile = {
        id: 'x',
        name: 'Future',
        game: 'platinum' as GameId,
        caught: [1],
        itemsTaken: [],
        milestonesDone: [],
        createdAt: 't',
        updatedAt: 't',
      };
      storage.update((s) => ({
        ...s,
        profiles: [...s.profiles, unsupported],
        activeProfileId: 'x',
      }));
      expect(store.activeProfile()?.name).toBe('Future');
      expect(store.canEditCatches('platinum' as GameId)).toBe(false);
      expect(store.toggleCaught('platinum' as GameId, 2)).toBe(false);
    });
  });

  describe('items taken (Phase 9)', () => {
    beforeEach(() => store.createProfile('Red run', 'red'));

    it('ticks and unticks items on the active profile, sorted, with undo', () => {
      expect(store.setItemTaken('red', 17, true, 'Picked up Potion')).toBe(true);
      expect(store.bulkSetItemsTaken('red', [3, 17, 200], true, 'Picked up 3 items')).toBe(true);
      expect(store.activeProfile()?.itemsTaken).toEqual([3, 17, 200]);
      expect(store.itemsTakenSet().has(200)).toBe(true);
      expect(store.activeProfile()?.caught).toEqual([]);

      expect(store.setItemTaken('red', 3, false, 'Put back Antidote')).toBe(true);
      expect(store.activeProfile()?.itemsTaken).toEqual([17, 200]);
      expect(store.undo()?.label).toBe('Put back Antidote');
      expect(store.activeProfile()?.itemsTaken).toEqual([3, 17, 200]);
    });

    it('counts towards the save reminder, but only real changes', () => {
      store.setItemTaken('red', 5, true, 'x');
      store.setItemTaken('red', 5, true, 'x');
      expect(storage.state().settings.changesSinceExport).toBe(1);
    });

    it('refuses another game and invalid numbers', () => {
      expect(store.setItemTaken('blue', 5, true, 'x')).toBe(false);
      expect(store.bulkSetItemsTaken('red', [1, 0], true, 'x')).toBe(false);
      expect(store.setItemTaken('red', 1.5, true, 'x')).toBe(false);
      expect(store.activeProfile()?.itemsTaken).toEqual([]);
    });

    it('copies ticks when duplicating', () => {
      store.setItemTaken('red', 9, true, 'x');
      expect(store.duplicateProfile(store.activeProfileId()!).itemsTaken).toEqual([9]);
    });
  });

  describe('milestones done (Phase 11)', () => {
    beforeEach(() => store.createProfile('Red run', 'red'));

    it('ticks and unticks milestones on the active profile, sorted, with undo', () => {
      store.setProgressPart(2);
      expect(store.setMilestoneDone('red', 6, true, 'Done: Defeat Brock')).toBe(true);
      expect(store.bulkSetMilestonesDone('red', [1, 6, 59], true, 'Done: 3 milestones')).toBe(true);
      expect(store.activeProfile()?.milestonesDone).toEqual([1, 6, 59]);
      expect(store.milestonesDoneSet().has(59)).toBe(true);
      expect(store.milestonesDoneIn('red').has(6)).toBe(true);
      // Ticking never touches catches, items or the progress part (the page offers that separately).
      expect(store.activeProfile()).toMatchObject({ caught: [], itemsTaken: [], progressPart: 2 });

      expect(store.setMilestoneDone('red', 1, false, 'Not done: starter')).toBe(true);
      expect(store.activeProfile()?.milestonesDone).toEqual([6, 59]);
      expect(store.undo()?.label).toBe('Not done: starter');
      expect(store.activeProfile()?.milestonesDone).toEqual([1, 6, 59]);
    });

    it('counts towards the save reminder, but only real changes', () => {
      store.setMilestoneDone('red', 5, true, 'x');
      store.setMilestoneDone('red', 5, true, 'x');
      expect(storage.state().settings.changesSinceExport).toBe(1);
    });

    it('refuses another game and invalid numbers, and shows other games none', () => {
      store.setMilestoneDone('red', 3, true, 'x');
      expect(store.setMilestoneDone('blue', 5, true, 'x')).toBe(false);
      expect(store.bulkSetMilestonesDone('red', [1, 0], true, 'x')).toBe(false);
      expect(store.setMilestoneDone('red', 1.5, true, 'x')).toBe(false);
      expect(store.activeProfile()?.milestonesDone).toEqual([3]);
      expect(store.milestonesDoneIn('blue').size).toBe(0);
    });

    it('copies milestones when duplicating', () => {
      store.setMilestoneDone('red', 9, true, 'x');
      expect(store.duplicateProfile(store.activeProfileId()!).milestonesDone).toEqual([9]);
    });
  });

  describe('import', () => {
    it('adds an imported profile, dropping species beyond the game’s dex', () => {
      const id = store.importProfile(
        {
          name: '',
          game: 'yellow',
          caught: [151, 3, 3, 152],
          itemsTaken: [40, 2, 40],
          milestonesDone: [6, 1, 6],
          progressPart: 2,
        },
        'new',
      );
      expect(store.activeProfile()).toMatchObject({
        id,
        name: 'Imported profile',
        game: 'yellow',
        caught: [3, 151],
        itemsTaken: [2, 40],
        milestonesDone: [1, 6],
        progressPart: 2,
      });
    });

    it('replaces a same-game profile’s progress and rejects another game', () => {
      const red = store.createProfile('Red', 'red');
      store.setCaught('red', 1, true);
      store.setItemTaken('red', 12, true, 'x');
      store.setMilestoneDone('red', 6, true, 'x');
      store.setProgressPart(5);
      expect(
        store.importProfile({ name: 'ignored', game: 'red', caught: [4, 7] }, 'replace', red.id),
      ).toBe(red.id);
      // A code without items or milestones (PKG1) stands for a profile with none.
      expect(store.activeProfile()).toMatchObject({
        name: 'Red',
        caught: [4, 7],
        itemsTaken: [],
        milestonesDone: [],
      });
      expect(store.activeProfile()).not.toHaveProperty('progressPart');
      expect(() =>
        store.importProfile({ name: 'x', game: 'blue', caught: [] }, 'replace', red.id),
      ).toThrow(/Cannot replace/);
    });
  });

  describe('undo', () => {
    it('reverts changes in reverse order with their labels', () => {
      const red = store.createProfile('Red', 'red');
      store.setCaught('red', 16, true, 'Marked Pidgey as caught');
      store.renameProfile(red.id, 'Renamed');
      expect(store.lastChange()?.label).toBe('Renamed profile to Renamed');

      expect(store.undo()?.label).toBe('Renamed profile to Renamed');
      expect(store.activeProfile()).toMatchObject({ name: 'Red', caught: [16] });
      expect(store.undo()?.label).toBe('Marked Pidgey as caught');
      expect(store.activeProfile()?.caught).toEqual([]);
      store.undo();
      expect(store.profiles()).toEqual([]);
      expect(store.undo()).toBeUndefined();
    });

    it('restores a deleted profile and the active selection', () => {
      const a = store.createProfile('A', 'red');
      store.createProfile('B', 'blue');
      store.setActive(a.id);
      store.deleteProfile(a.id);
      store.undo();
      expect(names()).toEqual(['A', 'B']);
      expect(store.activeProfileId()).toBe(a.id);
    });

    it(`keeps the last ${UNDO_LIMIT} changes`, () => {
      store.createProfile('Red', 'red');
      for (let dex = 1; dex <= UNDO_LIMIT + 5; dex++) store.setCaught('red', dex, true);
      let undone = 0;
      while (store.undo()) undone++;
      expect(undone).toBe(UNDO_LIMIT);
      expect(store.activeProfile()?.caught).toEqual([1, 2, 3, 4, 5]);
    });

    it('drops history when the profiles change elsewhere (another tab) but not on settings changes', () => {
      store.createProfile('Red', 'red');
      store.setCaught('red', 1, true);
      storage.update((s) => ({ ...s, settings: { ...s.settings, compactRows: true } }));
      expect(store.lastChange()).toBeDefined();

      storage.update((s) => ({ ...s, profiles: s.profiles.map((p) => ({ ...p, caught: [150] })) }));
      expect(store.lastChange()).toBeUndefined();
      expect(store.undo()).toBeUndefined();
      expect(store.activeProfile()?.caught).toEqual([150]);
      store.setCaught('red', 2, true);
      store.undo();
      expect(store.activeProfile()?.caught).toEqual([150]);
      expect(store.undo()).toBeUndefined();
    });
  });
});
