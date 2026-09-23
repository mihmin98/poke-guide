import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { GameDataService } from '../../core/data/game-data.service';
import { buildBackup } from '../../core/domain/backup';
import type { GameId } from '../../core/domain/models';
import { encodeProfile } from '../../core/domain/export-codec';
import { ProfileStore } from '../../core/profiles/profile.store';
import { SettingsStore } from '../../core/settings/settings.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { ImportPage } from './import.page';

const stub = {
  isLoading: signal(false),
  error: signal(undefined),
  checklist: signal([]),
  view: signal<unknown>(undefined),
};

const CODE = encodeProfile({
  name: 'Red run',
  game: 'red',
  caught: [1, 4, 7, 25],
  progressPart: 5,
});

describe('ImportPage (plan §12.4)', () => {
  let profiles: ProfileStore;
  let settings: SettingsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: GameDataService, useValue: { forGame: () => stub } },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
    settings = TestBed.inject(SettingsStore);
  });

  afterEach(() => {
    stub.view.set(undefined);
    TestBed.resetTestingModule();
  });

  function render() {
    const fixture = TestBed.createComponent(ImportPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (text: string) => {
      const area = el.querySelector<HTMLTextAreaElement>('textarea')!;
      area.value = text;
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, el, type };
  }

  it('previews a valid code', () => {
    const { el, type } = render();
    type(CODE);
    expect(el.querySelector('.preview h2')?.textContent).toBe('Red run');
    expect(el.querySelector('.preview .meta')?.textContent).toContain('4 caught');
    expect(el.querySelector('.preview .meta')?.textContent).toContain('Part 5');
    expect(el.querySelector('.status.error')).toBeNull();
  });

  it('previews and imports the items a PKG2 code carries (Phase 9)', async () => {
    const withItems = encodeProfile({
      name: 'Items run',
      game: 'red',
      caught: [1],
      itemsTaken: [3, 17, 999],
    });
    const { fixture, el, type } = render();
    type(withItems);
    // Until the game data loads, every number counts.
    expect(el.querySelector('.preview .meta')?.textContent).toContain('3 items picked up');

    // Once it has, only items of this game that the data knows are counted.
    stub.view.set({
      locations: [
        {
          items: [
            { no: 3, games: ['red'] },
            { no: 17, games: ['blue'] },
          ],
        },
      ],
    });
    fixture.detectChanges();
    expect(el.querySelector('.preview .meta')?.textContent).toContain('1 item picked up');

    el.querySelector<HTMLButtonElement>('.actions button')!.click();
    await fixture.whenStable();
    // Unknown numbers are kept: a later data build may know them again.
    expect(profiles.activeProfile()?.itemsTaken).toEqual([3, 17, 999]);
  });

  it('explains an invalid code without offering to import it', () => {
    const { el, type } = render();
    type('PKG1-notreallyacode');
    expect(el.querySelector('.status.error')?.textContent).toBeTruthy();
    expect(el.querySelector('.preview')).toBeNull();
  });

  it('imports as a new profile, activates it and opens its checklist', async () => {
    const { fixture, el, type } = render();
    type(CODE);
    el.querySelector<HTMLButtonElement>('.actions button')!.click();
    await fixture.whenStable();

    expect(profiles.profiles()).toHaveLength(1);
    expect(profiles.activeProfile()).toMatchObject({
      name: 'Red run',
      game: 'red',
      caught: [1, 4, 7, 25],
      progressPart: 5,
    });
    expect(TestBed.inject(Router).url).toBe('/red/checklist');
  });

  it('gives an imported profile a free name when one is taken', async () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el, type } = render();
    type(CODE);
    el.querySelector<HTMLButtonElement>('.actions button')!.click();
    await fixture.whenStable();

    expect(profiles.profiles().map((p) => p.name)).toEqual(['Red run', 'Red run (2)']);
  });

  it('replaces an existing profile of the same game, after a confirmation step', async () => {
    const target = profiles.createProfile('Old run', 'red');
    profiles.createProfile('Yellow run', 'yellow');
    const { fixture, el, type } = render();
    type(CODE);

    const select = el.querySelector<HTMLSelectElement>('.actions select')!;
    // Only the Red profile can be replaced.
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      'choose a profile…',
      'Old run (0 caught)',
    ]);
    select.value = target.id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const confirm = [...el.querySelectorAll<HTMLButtonElement>('.actions button')].find((b) =>
      b.textContent?.includes('Replace “Old run”'),
    )!;
    confirm.click();
    fixture.detectChanges();

    [...el.querySelectorAll<HTMLButtonElement>('.actions button')]
      .find((b) => b.textContent?.includes('Yes, overwrite'))!
      .click();
    await fixture.whenStable();

    expect(profiles.profiles()).toHaveLength(2);
    expect(profiles.profiles().find((p) => p.id === target.id)).toMatchObject({
      name: 'Old run',
      caught: [1, 4, 7, 25],
    });
  });

  it('clears the save reminder once progress exists elsewhere', async () => {
    settings.set('changesSinceExport', 42);
    const { fixture, el, type } = render();
    type(CODE);
    el.querySelector<HTMLButtonElement>('.actions button')!.click();
    await fixture.whenStable();

    expect(settings.settings().changesSinceExport).toBe(0);
  });

  it('restores every supported profile from a backup file', async () => {
    const backup = buildBackup([
      {
        id: 'a',
        name: 'Backup red',
        game: 'red',
        caught: [2],
        itemsTaken: [],
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'b',
        name: 'From a future game',
        // A profile saved by a newer build, for a game this one doesn't know.
        game: 'scarlet' as GameId,
        caught: [3],
        itemsTaken: [],
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const { fixture, el } = render();
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(profiles.profiles().map((p) => p.name)).toEqual(['Backup red']);
    expect(el.querySelector('.backup .status')?.textContent).toContain('Restored 1 profile');
    expect(el.querySelector('.backup .status')?.textContent).toContain('skipped 1');
  });
});
