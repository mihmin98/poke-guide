import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, Scroll, provideRouter, type Event } from '@angular/router';
import type { Subject } from 'rxjs';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { GameDataService } from '../../core/data/game-data.service';
import { buildGameView, type GameView } from '../../core/domain/game-view';
import { buildJourney } from '../../core/domain/journey';
import type { Milestone } from '../../core/domain/models';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import { ProfileStore } from '../../core/profiles/profile.store';
import { ProgressOfferService } from '../../core/profiles/progress-offer.service';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { StoryPage } from './story.page';

const milestones: Milestone[] = [
  {
    no: 6,
    id: 'gym-brock',
    label: 'Defeat Brock',
    kind: 'gym',
    part: { red: 3 },
    locationId: 'pewter-city',
    detail: 'Boulder Badge · TM34 Bide',
    badge: 'Boulder',
    teams: {
      red: [
        {
          trainer: 'Brock',
          prize: 1386,
          pokemon: [
            { dex: 74, level: 12, moves: [{ name: 'Tackle', type: 'normal' }] },
            { dex: 95, level: 14, moves: [{ name: 'Bide', type: 'normal' }] },
          ],
        },
      ],
    },
  },
  {
    no: 40,
    id: 'snorlax',
    grants: ['old-rod'],
    label: 'Wake the Snorlax',
    kind: 'encounter',
    part: { red: 11 },
    locationId: 'route-16',
    dex: 143,
    optional: true,
  },
];

const data = testData({
  games: ['red'],
  species: [
    testSpecies(10, { name: 'Caterpie' }),
    testSpecies(129, { name: 'Magikarp' }),
    testSpecies(143, { name: 'Snorlax', slug: 'snorlax' }),
  ],
  walkthroughs: {
    red: [
      { part: 3, title: 'Pewter City', region: 'kanto' },
      { part: 11, title: 'Route 16', region: 'kanto' },
    ],
  },
  unlocks: {
    red: [{ id: 'old-rod', label: 'Old Rod', kind: 'key-item', locationId: 'route-16', part: 11 }],
  },
  locations: [
    testLocation(
      'viridian-forest',
      3,
      [testEncounter(10, ['red']), testEncounter(129, ['red'], { requires: ['old-rod'] })],
      ['red'],
      { name: 'Viridian Forest' },
    ),
    testLocation('pewter-city', 3, [], ['red'], {
      name: 'Pewter City',
      placement: { red: { part: 3, order: 301 } },
    }),
    testLocation('route-16', 11, [], ['red'], { name: 'Route 16' }),
  ],
  milestones,
});

const view = signal<GameView | undefined>(buildGameView(data, 'red'));
const stub = {
  isLoading: signal(false),
  error: signal(undefined),
  view,
  journey: computed(() => {
    const current = view();
    return current ? buildJourney(current, 'red') : [];
  }),
  checklist: signal([]),
};

describe('StoryPage (plan §13.12)', () => {
  let profiles: ProfileStore;
  let offers: [string, number][];

  beforeEach(() => {
    offers = [];
    stub.view.set(buildGameView(data, 'red'));
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: GameDataService, useValue: { forGame: () => stub } },
        {
          provide: ProgressOfferService,
          useValue: {
            offer: (game: string, part: number) => (offers.push([game, part]), Promise.resolve()),
          },
        },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(StoryPage);
    fixture.componentRef.setInput('game', 'red');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim();

  it('lists milestones by part with their kind, detail and links', () => {
    const { el } = render();
    expect([...el.querySelectorAll('.part-title')].map(text)).toEqual([
      'Part 3 · Pewter City',
      'Part 11 · Route 16',
    ]);
    const rows = el.querySelectorAll('app-milestone-row');
    expect(text(rows[0]!.querySelector('.label'))).toBe('Defeat Brock');
    expect(text(rows[0]!.querySelector('.tags'))).toBe('Gym');
    expect(text(rows[0]!.querySelector('.more'))).toContain('Boulder Badge · TM34 Bide');
    expect(rows[0]!.querySelector('a')?.getAttribute('href')).toBe('/red/story/pewter-city');
    expect([...rows[1]!.querySelectorAll('.badge')].map(text)).toEqual(['Encounter', 'Optional']);
    expect(rows[1]!.querySelector('a[href="/red/pokemon/snorlax"]')).not.toBeNull();
  });

  it("opens a battle's Team panel (Phase 19)", () => {
    const { fixture, el } = render();
    const button = el.querySelector<HTMLButtonElement>('.team-toggle')!;
    expect(text(button)).toBe('expand_more Team · Lv 12–14');
    button.click();
    fixture.detectChanges();
    expect(text(el.querySelector('app-milestone-team .trainer'))).toBe('Brock · ₽1,386');
    expect(el.querySelectorAll('app-milestone-team .members > li')).toHaveLength(2);
  });

  it('shows the areas between milestones and what an unlock opens', () => {
    const { el } = render();
    const rows = [...el.querySelectorAll('.rows > li')].map((li) => li.className);
    expect(rows).toEqual(['area', 'milestone', 'milestone', 'opens']);
    const card = el.querySelector('app-area-card a')!;
    expect(card.getAttribute('href')).toBe('/red/story/viridian-forest');
    expect(text(card.querySelector('.name'))).toBe('Viridian Forest');
    expect(text(card.querySelector('.count'))).toBe('Pokémon caught 0/1');
    expect(text(card.querySelector('.later'))).toBe('lock 1 more later · Old Rod');
    const callout = el.querySelector('app-unlock-callout')!;
    expect(text(callout.querySelector('summary'))).toContain(
      'Old Rod · 1 earlier area has something you still need',
    );
    expect(callout.querySelector('a')?.getAttribute('href')).toBe('/red/story/viridian-forest');
  });

  it('hides finished areas, and callouts once what they open is caught', () => {
    profiles.createProfile('Red run', 'red');
    profiles.setCaught('red', 10, true);
    profiles.setCaught('red', 129, true);
    const { fixture, el } = render();
    expect(el.querySelector('app-unlock-callout')).toBeNull();
    el.querySelectorAll<HTMLButtonElement>('.controls .chip')[1]!.click();
    fixture.detectChanges();
    expect(el.querySelector('app-area-card')).toBeNull();
  });

  it('opens and scrolls to the part of a #m- deep link', async () => {
    const { fixture, el } = render();
    el.querySelector<HTMLButtonElement>('#part-11 .part-head button')!.click();
    fixture.detectChanges();
    expect(el.querySelector('#m-snorlax')).toBeNull();

    // The router's scroller (only set up when the app bootstraps) emits this once it has scrolled to the top.
    const url = '/red/story#m-snorlax';
    (TestBed.inject(Router).events as Subject<Event>).next(
      new Scroll(new NavigationEnd(1, url, url), null, 'm-snorlax'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const row = el.querySelector('#m-snorlax');
    expect(row).not.toBeNull();
    expect(row!.contains(document.activeElement)).toBe(true);
  });

  it('ticks a milestone on the active profile and offers to move the progress there', () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el } = render();
    expect(el.querySelector('app-progress-ring')?.textContent).toContain('0');

    el.querySelector<HTMLButtonElement>('app-milestone-toggle button')!.click();
    fixture.detectChanges();
    expect(profiles.activeProfile()?.milestonesDone).toEqual([6]);
    expect(offers).toEqual([['red', 3]]);
    expect(text(el.querySelector('.part-head .count'))).toBe('1/1');
    expect(el.querySelector('app-milestone-toggle button')?.getAttribute('aria-checked')).toBe(
      'true',
    );

    // Unticking never offers anything, and never touches the part.
    el.querySelector<HTMLButtonElement>('app-milestone-toggle button')!.click();
    fixture.detectChanges();
    expect(profiles.activeProfile()?.milestonesDone).toEqual([]);
    expect(offers).toHaveLength(1);
  });

  it('hides done milestones on request', () => {
    profiles.createProfile('Red run', 'red');
    profiles.setMilestoneDone('red', 6, true, 'x');
    const { fixture, el } = render();
    el.querySelector<HTMLButtonElement>('.controls .chip')!.click();
    fixture.detectChanges();
    expect([...el.querySelectorAll('app-milestone-row .label')].map(text)).toEqual([
      'Wake the Snorlax',
    ]);

    profiles.setMilestoneDone('red', 40, true, 'x');
    fixture.detectChanges();
    expect(text(el.querySelector('.status'))).toBe('Every story milestone is done.');
  });

  it('disables the toggles without a profile for this game', () => {
    profiles.createProfile('Blue run', 'blue');
    const { el } = render();
    const toggle = el.querySelector<HTMLButtonElement>('app-milestone-toggle button')!;
    expect(toggle.disabled).toBe(true);
    expect(toggle.title).toBe('Your active profile is for another game');
  });

  it('says so when the game has no story checklist', () => {
    stub.view.set(buildGameView(testData({ games: ['red'] }), 'red'));
    const { el } = render();
    expect(text(el.querySelector('.status'))).toBe(
      'There is no story checklist for Pokémon Red yet.',
    );
    expect(el.querySelector('app-progress-ring')).toBeNull();
  });
});
