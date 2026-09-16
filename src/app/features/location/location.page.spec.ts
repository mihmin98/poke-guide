import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

  it('explains a location that is not in this game', () => {
    const { el } = render('nowhere');
    expect(el.querySelector('.status')?.textContent).toContain('not in');
  });
});
