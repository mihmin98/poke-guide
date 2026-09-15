import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import type { GameId } from '../../core/domain/models';
import { ProfileStore } from '../../core/profiles/profile.store';
import { STATE_STORAGE, StorageService } from '../../core/storage/storage.service';
import { ProfilesPage } from './profiles.page';

describe('ProfilesPage (plan §12.1)', () => {
  let profiles: ProfileStore;
  /** What the next dialog resolves with; `undefined` means the user cancelled. */
  let dialogResult: unknown;

  beforeEach(() => {
    dialogResult = undefined;
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(ProfilesPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const cardNames = (el: HTMLElement) =>
    [...el.querySelectorAll('.card h2')].map((h) => h.textContent?.trim());

  it('invites you to create one when there are no profiles', () => {
    const { el } = render();
    expect(el.querySelector('.empty')?.textContent).toContain('no profiles yet');
    expect(cardNames(el)).toEqual([]);
  });

  it('lists profiles with their game, caught count and the active one marked', async () => {
    const red = profiles.createProfile('Red run', 'red');
    profiles.createProfile('Yellow run', 'yellow');
    profiles.setCaught('yellow', 25, true);
    const { fixture, el } = render();
    await fixture.whenStable();

    expect(cardNames(el)).toEqual(['Red run', 'Yellow run']);
    const [first, second] = [...el.querySelectorAll('.card')];
    expect(first?.querySelector('.meta')?.textContent).toContain('Red');
    expect(second?.querySelector('.meta')?.textContent).toContain('1 caught');
    // Yellow was created last, so it is the active one.
    expect(second?.querySelector('.active-chip')?.textContent?.trim()).toBe('Active');
    expect(first?.querySelector('.active-chip')).toBeNull();
    expect(profiles.activeProfileId()).not.toBe(red.id);
  });

  it('switches the active profile from the card', async () => {
    const red = profiles.createProfile('Red run', 'red');
    profiles.createProfile('Yellow run', 'yellow');
    const { fixture, el } = render();
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.card button[matbutton]')?.click();
    await fixture.whenStable();
    expect(profiles.activeProfileId()).toBe(red.id);
  });

  it('creates a profile from the dialog result', async () => {
    dialogResult = { name: 'From dialog', game: 'blue' };
    const { fixture, el } = render();
    el.querySelector<HTMLButtonElement>('.head button')!.click();
    await fixture.whenStable();

    expect(profiles.profiles()).toHaveLength(1);
    expect(profiles.activeProfile()).toMatchObject({ name: 'From dialog', game: 'blue' });
  });

  it('keeps the profile when the create dialog is cancelled', async () => {
    dialogResult = undefined;
    const { fixture, el } = render();
    el.querySelector<HTMLButtonElement>('.head button')!.click();
    await fixture.whenStable();

    expect(profiles.profiles()).toEqual([]);
  });

  it('labels a profile whose game this build does not know, and offers no Use button', async () => {
    profiles.createProfile('Red run', 'red');
    profiles.createProfile('Future run', 'red');
    // A profile saved by a newer app: its game is not in this build's registry.
    const [, future] = profiles.profiles();
    TestBed.inject(StorageService).update((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === future!.id ? { ...p, game: 'gold' as GameId } : p)),
      activeProfileId: s.profiles[0]!.id,
    }));
    const { fixture, el } = render();
    await fixture.whenStable();

    const cards = [...el.querySelectorAll('.card')];
    expect(cards[1]?.querySelector('.meta .chip')?.textContent?.trim()).toBe('Unsupported game');
    expect(cards[1]?.querySelector('button[matbutton]')).toBeNull();
  });
});
