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
  no: 1,
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

const FOSSIL: LocationItem = {
  ...ITEM,
  obtain: 'choice',
  hidden: undefined,
  requires: undefined,
  choiceGroupId: 'fossil',
};

const data = testData({
  games: ['red'],
  species: [
    testSpecies(16, { name: 'Pidgey', types: ['normal', 'flying'], catchRate: 255 }),
    testSpecies(72, { name: 'Tentacool' }),
  ],
  unlocks: { red: [{ id: 'cut-hm', label: 'Cut', kind: 'move', locationId: 'a', part: 5 }] },
  milestones: [
    {
      no: 1,
      id: 'parcel',
      label: 'Deliver the parcel',
      kind: 'event',
      part: { red: 1 },
      locationId: 'route-1',
    },
    {
      no: 2,
      id: 'pidgey-gift',
      label: 'Receive Pidgey',
      kind: 'gift',
      part: { red: 2 },
      locationId: 'route-2',
      dex: 16,
      optional: true,
    },
  ],
  locations: [
    testLocation('route-1', 1, [testEncounter(16, ['red'])], ['red'], {
      name: 'Route 1',
      items: [
        { ...FOSSIL, no: 2, itemId: 'dome-fossil', name: 'Dome Fossil' },
        { ...FOSSIL, no: 3, itemId: 'helix-fossil', name: 'Helix Fossil' },
      ],
    }),
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

  describe('item pickup tracking (Phase 9)', () => {
    const toggles = (el: HTMLElement) => [
      ...el.querySelectorAll<HTMLButtonElement>('app-item-toggle button'),
    ];
    const chip = (el: HTMLElement, text: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) =>
        b.textContent?.includes(text),
      )!;

    it('ticks an item on the active profile and counts it', () => {
      const { fixture, el } = render();
      expect(toggles(el)[0]!.disabled).toBe(true);

      profiles.createProfile('Red run', 'red');
      fixture.detectChanges();
      expect(el.querySelector('.items h2')?.textContent).toContain('0/1');
      toggles(el)[0]!.click();
      fixture.detectChanges();

      expect(profiles.activeProfile()?.itemsTaken).toEqual([1]);
      expect(profiles.activeProfile()?.caught).toEqual([]);
      expect(toggles(el)[0]!.getAttribute('aria-checked')).toBe('true');
      expect(toggles(el)[0]!.getAttribute('aria-label')).toBe('Rare Candy, picked up');
      expect(el.querySelector('.items h2')?.textContent).toContain('1/1');

      chip(el, 'Hide items I have').click();
      fixture.detectChanges();
      expect(el.querySelector('.row.item')).toBeNull();
      expect(el.querySelector('.items .status')?.textContent).toContain('every item');
    });

    it('turns the other option of a choice off once one is picked', () => {
      profiles.createProfile('Red run', 'red');
      const { fixture, el } = render('route-1');
      toggles(el)[0]!.click();
      fixture.detectChanges();

      const [dome, helix] = toggles(el);
      expect(dome!.getAttribute('aria-checked')).toBe('true');
      expect(helix!.disabled).toBe(true);
      expect(helix!.title).toBe('You chose the Dome Fossil');
      expect(el.querySelectorAll('.row.item')[1]!.textContent).toContain(
        'You chose the Dome Fossil',
      );
      // The choice counts once.
      expect(el.querySelector('.items h2')?.textContent).toContain('1/1');

      chip(el, 'Hide items I have').click();
      fixture.detectChanges();
      expect(el.querySelector('.row.item')).toBeNull();
    });

    it('neither shows nor edits another game’s ticks', () => {
      profiles.createProfile('Blue run', 'blue');
      profiles.importProfile({ name: 'x', game: 'blue', caught: [], itemsTaken: [1] }, 'new');
      const { el } = render();
      expect(toggles(el)[0]!.disabled).toBe(true);
      expect(toggles(el)[0]!.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('lists the story milestones that happen here, and ticks them (Phase 11)', () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el } = render();
    const story = el.querySelector('section.story')!;
    expect(story.querySelector('h2')?.textContent).toContain('0/1');
    const rows = story.querySelectorAll('app-milestone-row');
    expect([...rows].map((r) => r.querySelector('.label')?.textContent)).toEqual([
      'Receive Pidgey',
    ]);
    // No link back to this location, but one to the Pokémon.
    expect(rows[0]!.querySelector('a')?.getAttribute('href')).toBe('/red/pokemon/mon16');

    rows[0]!.querySelector<HTMLButtonElement>('app-milestone-toggle button')!.click();
    fixture.detectChanges();
    expect(profiles.activeProfile()?.milestonesDone).toEqual([2]);
    expect(story.querySelector('h2')?.textContent).toContain('1/1');
  });

  it('shows only the milestones of the location itself', () => {
    const rows = render('route-1').el.querySelectorAll('section.story app-milestone-row');
    expect([...rows].map((r) => r.querySelector('.label')?.textContent)).toEqual([
      'Deliver the parcel',
    ]);
    expect(rows[0]!.querySelector('.more')).toBeNull();
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
