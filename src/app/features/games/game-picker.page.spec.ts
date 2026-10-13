import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { ProfileStore } from '../../core/profiles/profile.store';
import { PLANNED_GAMES_OPEN } from '../../core/routing/planned-games';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { GamePickerPage } from './game-picker.page';

describe('GamePickerPage (plan §13.3)', () => {
  let profiles: ProfileStore;

  function setUp(plannedGamesOpen: boolean) {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: PLANNED_GAMES_OPEN, useValue: plannedGamesOpen },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
  }

  beforeEach(() => setUp(false));

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(GamePickerPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const cardFor = (el: HTMLElement, game: string) =>
    el.querySelector<HTMLAnchorElement>(`.game-${game} .card`);

  it('offers to start a game that has no profile, linking to onboarding', () => {
    const card = cardFor(render(), 'red');
    expect(card?.querySelector('.action')?.textContent?.trim()).toBe('Start');
    expect(card?.getAttribute('href')).toBe('/red/welcome');
  });

  it('counts the profiles per game and links straight to the guide', () => {
    profiles.createProfile('Run one', 'red');
    profiles.createProfile('Run two', 'red');
    profiles.createProfile('Yellow run', 'yellow');
    const el = render();
    expect(cardFor(el, 'red')?.querySelector('.action')?.textContent?.trim()).toBe('2 profiles');
    expect(cardFor(el, 'red')?.getAttribute('href')).toBe('/red/guide');
    expect(cardFor(el, 'yellow')?.querySelector('.action')?.textContent?.trim()).toBe('1 profile');
    expect(cardFor(el, 'blue')?.querySelector('.action')?.textContent?.trim()).toBe('Start');
  });

  it('shows the release year next to the name', () => {
    expect(cardFor(render(), 'yellow')?.querySelector('.name .year')?.textContent?.trim()).toBe(
      '1999',
    );
  });

  it('lists each version group on its own row', () => {
    const gen3 = render().querySelector('#gen-3')!.closest('section')!;
    const rows = [...gen3.querySelectorAll('.cards')].map((row) =>
      [...row.querySelectorAll('li')].map((li) => li.className),
    );
    expect(rows).toEqual([
      ['game-ruby', 'game-sapphire', 'game-emerald'],
      ['game-firered', 'game-leafgreen'],
    ]);
  });

  it('shows planned games as Coming Soon cards that do not open', () => {
    const card = render().querySelector('.game-diamond .card');
    expect(card?.tagName).toBe('DIV');
    expect(card?.querySelector('.badge')?.textContent?.trim()).toBe('Coming Soon');
    expect(card?.querySelector('.action')).toBeNull();
  });

  it('opens planned games in dev builds, still marked Coming Soon', () => {
    TestBed.resetTestingModule();
    setUp(true);
    const card = cardFor(render(), 'diamond');
    expect(card?.getAttribute('href')).toBe('/diamond/welcome');
    expect(card?.querySelector('.badge')?.textContent?.trim()).toBe('Coming Soon');
  });
});
