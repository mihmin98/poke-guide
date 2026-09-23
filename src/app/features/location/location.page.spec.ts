import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { GameDataService } from '../../core/data/game-data.service';
import { buildGameView } from '../../core/domain/game-view';
import type { LocationItem } from '../../core/domain/models';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import { ProfileStore } from '../../core/profiles/profile.store';
import { SettingsStore } from '../../core/settings/settings.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { LocationPage } from './location.page';

const ITEM: LocationItem = {
  itemId: 'rare-candy',
  name: 'Rare Candy',
  quantity: 1,
  games: ['red'],
  obtain: 'pickup',
  hidden: true,
  subArea: 'B1F',
  where: 'In the south-west corner',
  requires: [['cut-hm']],
};

const data = testData({
  games: ['red'],
  species: [
    testSpecies(16, { name: 'Pidgey', types: ['normal', 'flying'], catchRate: 255 }),
    testSpecies(72, { name: 'Tentacool' }),
  ],
  unlocks: { red: [{ id: 'cut-hm', label: 'Cut', kind: 'move', locationId: 'a', part: 5 }] },
  locations: [
    testLocation('route-1', 1, [testEncounter(16, ['red'])], ['red'], { name: 'Route 1' }),
    testLocation(
      'route-2',
      2,
      [
        testEncounter(16, ['red'], {
          games: { red: [{ levels: { min: 2, max: 5 }, rate: { kind: 'percent', value: 45 } }] },
        }),
      ],
      ['red'],
      {
        name: 'Route 2',
        items: [ITEM],
        subAreas: [
          {
            id: 'main',
            name: null,
            encounters: [
              testEncounter(16, ['red'], {
                games: {
                  red: [{ levels: { min: 2, max: 5 }, rate: { kind: 'percent', value: 45 } }],
                },
              }),
            ],
          },
          {
            id: 'water',
            name: 'Water',
            encounters: [testEncounter(72, ['red'], { method: 'surf', requires: ['cut-hm'] })],
          },
        ],
      },
    ),
  ],
});

const stub = {
  isLoading: signal(false),
  error: signal(undefined),
  view: signal(buildGameView(data, 'red')),
  checklist: signal([{ dex: 16, obtainable: true, sources: [], exclusiveGroupIds: [] }]),
};

describe('LocationPage (plan §13.5)', () => {
  let profiles: ProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: GameDataService, useValue: { forGame: () => stub } },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render(locationId = 'route-2') {
    const fixture = TestBed.createComponent(LocationPage);
    fixture.componentRef.setInput('game', 'red');
    fixture.componentRef.setInput('locationId', locationId);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the header, the Bulbapedia source at its revid and the neighbours', () => {
    const { el } = render();
    TestBed.tick();
    expect(document.title).toBe('Route 2 · Pokémon Red · Poké Guide');
    expect(el.querySelector('h1')?.textContent).toBe('Route 2');
    expect(el.querySelector('.meta')?.textContent).toContain('Part 2');
    expect(el.querySelector('.meta a')?.getAttribute('href')).toBe(
      'https://bulbapedia.bulbagarden.net/w/index.php?title=route-2&oldid=1',
    );
    expect(el.querySelector('.prev-next a')?.getAttribute('href')).toBe('/red/guide/route-1');
  });

  it('renders an encounter row with types, levels, rate and catch rate', () => {
    const { el } = render();
    const row = el.querySelector('.row')!;
    expect(row.querySelector('.name')?.textContent).toContain('#016');
    expect(row.querySelector('.name')?.textContent).toContain('Pidgey');
    expect([...row.querySelectorAll('app-type-badge')].map((b) => b.textContent?.trim())).toEqual([
      'Normal',
      'Flying',
    ]);
    expect(row.querySelector('app-level-range')?.textContent).toContain('Lv 2–5');
    expect(row.querySelector('app-rate')?.textContent).toContain('45%');
    expect(row.querySelector('.cr')?.textContent?.trim()).toBe('CR 255');
    // The catch rate opens the calculator for this species at the lowest level it appears (§13.11).
    expect(row.querySelector('.cr')?.getAttribute('href')).toBe('/red/tools/catch?dex=16&level=2');
  });

  it('groups sub-areas into tabs and shows one at a time', () => {
    const { fixture, el } = render();
    const tabs = [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['All', 'Main area', 'Water']);
    expect(el.querySelectorAll('.row:not(.item)').length).toBe(2);

    // Method headings nest under an area heading only where one is shown (the unnamed main area has none).
    expect([...el.querySelectorAll('.area h2, .area h3')].map((h) => h.tagName)).toEqual([
      'H2',
      'H2',
      'H3',
    ]);

    tabs[2]!.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.row:not(.item)').length).toBe(1);
    expect(el.querySelector('.row .name')?.textContent).toContain('Tentacool');
    expect(el.querySelector('.row .badge.lock')?.textContent).toContain('Cut');
  });

  it('disables catch toggles and explains why without a matching profile', () => {
    const { el } = render();
    expect(el.querySelector('app-game-mismatch-banner')?.textContent).toContain('no profile yet');
    expect(el.querySelector<HTMLButtonElement>('app-catch-toggle button')!.disabled).toBe(true);
  });

  it('toggles a catch and can hide the species already caught', () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el } = render();
    expect(el.querySelector('app-game-mismatch-banner')?.textContent?.trim()).toBe('');

    el.querySelector<HTMLButtonElement>('app-catch-toggle button')!.click();
    fixture.detectChanges();
    expect(profiles.isCaught(16)).toBe(true);

    const onlyMissing = [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) =>
      b.textContent?.includes('only missing'),
    )!;
    onlyMissing.click();
    fixture.detectChanges();
    expect([...el.querySelectorAll('.row .name')].map((n) => n.textContent)).not.toContain(
      'Pidgey',
    );
  });

  it('lists the items with their badges, and can hide the hidden ones', () => {
    const { fixture, el } = render();
    const item = el.querySelector('.row.item')!;
    expect(item.textContent).toContain('Rare Candy');
    expect([...item.querySelectorAll('.badge')].map((b) => b.textContent?.trim())).toEqual([
      'Pickup',
      'Hidden',
      'lock Cut',
    ]);
    expect(item.querySelector('.where')?.textContent).toContain('south-west');

    const showHidden = [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) =>
      b.textContent?.includes('Show hidden'),
    )!;
    showHidden.click();
    fixture.detectChanges();
    expect(el.querySelector('.row.item')).toBeNull();
  });

  it('follows the rate, sprite size and compact-row settings', () => {
    const settings = TestBed.inject(SettingsStore);
    const { fixture, el } = render();
    expect(el.querySelector('.row app-sprite img')?.getAttribute('width')).toBe('40');
    expect(el.querySelector('.rows')?.classList.contains('compact')).toBe(false);

    settings.set('showRates', false);
    settings.set('showCatchRates', false);
    settings.set('spriteScale', 3);
    settings.set('compactRows', true);
    fixture.detectChanges();
    const row = el.querySelector('.row')!;
    expect(row.querySelector('app-rate')).toBeNull();
    expect(row.querySelector('.cr')).toBeNull();
    expect(row.querySelector('app-sprite img')?.getAttribute('width')).toBe('56');
    expect(el.querySelector('.rows')?.classList.contains('compact')).toBe(true);
  });

  it('swipes to the neighbouring locations in walkthrough order', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { el } = render();
    /** jsdom has no Touch constructor, so the touch lists are attached by hand. */
    const touch = (type: 'touchstart' | 'touchend', x: number) => {
      const point = [{ clientX: x, clientY: 300 }];
      const event = new Event(type);
      Object.defineProperty(event, 'touches', { value: type === 'touchstart' ? point : [] });
      Object.defineProperty(event, 'changedTouches', { value: point });
      el.dispatchEvent(event);
    };
    const swipe = (from: number, to: number) => {
      touch('touchstart', from);
      touch('touchend', to);
    };

    swipe(200, 400);
    expect(navigate).toHaveBeenLastCalledWith(['/', 'red', 'guide', 'route-1']);
    navigate.mockClear();
    // Route 2 is the last location, so there is nothing to the left of it.
    swipe(400, 200);
    expect(navigate).not.toHaveBeenCalled();
    // A touch from the screen edge is the browser's own back gesture.
    swipe(5, 300);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('explains a location that is not in this game', () => {
    const { el } = render('nowhere');
    expect(el.querySelector('.status')?.textContent).toContain('not in');
  });
});
