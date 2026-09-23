import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { GameDataService } from '../../core/data/game-data.service';
import { buildGameView } from '../../core/domain/game-view';
import type { PokedexData } from '../../core/domain/models';
import { buildChecklist } from '../../core/domain/obtainability';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import { ProfileStore } from '../../core/profiles/profile.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { PokemonPage } from './pokemon.page';

const data = testData({
  games: ['red', 'blue'],
  species: [
    testSpecies(16, {
      name: 'Pidgey',
      slug: 'pidgey',
      types: ['normal', 'flying'],
      category: 'Tiny Bird',
      heightM: 0.3,
      weightKg: 1.8,
      baseExp: 55,
      growthRate: 'medium-slow',
      baseStats: { hp: 40, atk: 45, def: 40, spc: 35, spe: 56 },
    }),
    testSpecies(17, { name: 'Pidgeotto', slug: 'pidgeotto' }),
  ],
  evolutions: [{ from: 16, to: 17, trigger: 'level', level: 18, requiresTrade: false }],
  locations: [
    testLocation('route-1', 1, [testEncounter(16, ['red'])], ['red', 'blue'], { name: 'Route 1' }),
    testLocation('route-2', 2, [testEncounter(16, ['blue'])], ['red', 'blue'], { name: 'Route 2' }),
  ],
});

const pokedex: PokedexData = {
  schemaVersion: 1,
  versionGroupId: 'rby',
  builtAt: '',
  moves: [
    { id: 'gust', name: 'Gust', type: 'normal', power: 40, accuracy: 100, pp: 35 },
    { id: 'cut', name: 'Cut', type: 'normal', power: 50, accuracy: 95, pp: 30, machine: 'HM01' },
  ],
  learnsets: {
    '16': { levelUp: [{ move: 'gust', levels: { red: 1 } }], machines: ['cut'], prevo: [] },
  },
  entries: { '16': [{ games: ['red'], text: 'A common sight in forests.' }] },
  sources: [],
};

const stub = {
  isLoading: signal(false),
  error: signal(undefined),
  data: signal(data),
  view: signal(buildGameView(data, 'red')),
  speciesByDex: signal(new Map(data.species.map((s) => [s.dex, s]))),
  checklist: signal(
    buildChecklist(data, { id: 'red', nationalDexMax: 17 }, { breeding: false } as never),
  ),
  pokedex: () => ({ hasValue: () => true, value: () => pokedex, isLoading: signal(false) }),
};

describe('PokemonPage (plan §13.7)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: GameDataService, useValue: { forGame: () => stub } },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render(key = 'pidgey') {
    const fixture = TestBed.createComponent(PokemonPage);
    fixture.componentRef.setInput('game', 'red');
    fixture.componentRef.setInput('key', key);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the species header and its facts', () => {
    const { el } = render();
    TestBed.tick();
    expect(document.title).toBe('Pidgey · Pokémon Red · Poké Guide');
    expect(el.querySelector('h1')?.textContent).toBe('Pidgey');
    expect(el.querySelector('.num')?.textContent).toBe('#016');
    expect([...el.querySelectorAll('app-type-badge')][0]?.textContent?.trim()).toBe('Normal');
    expect(el.querySelector('.facts')?.textContent).toContain('0.3 m');
    expect(el.querySelector('.facts')?.textContent).toContain('Medium Slow');
  });

  it('lists where to find it here and in the other game of the group', () => {
    const { el } = render();
    expect(el.querySelector('.sources a')?.getAttribute('href')).toBe('/red/guide/route-1');
    expect(el.textContent).toContain('Other games in this version group');
    expect(el.textContent).toContain('Pokémon Blue');
    expect(el.textContent).toContain('Route 2');
  });

  it('draws the evolution line with its trigger', () => {
    const { el } = render();
    expect(el.querySelector('.family')?.textContent).toContain('Pidgeotto');
    expect(el.querySelector('.arrow')?.textContent).toContain('Lv 18');
  });

  it('renders the Pokédex entry and the learnsets from the lazily loaded file', () => {
    const { el } = render();
    expect(el.querySelector('blockquote')?.textContent).toContain('common sight');
    expect(el.querySelector('table.moves tbody tr')?.textContent).toContain('Gust');
    expect(el.querySelector('.machines')?.textContent).toContain('HM01');
  });

  it('shows the catch rate, base stats and the quick catch grid (plan §13.11)', () => {
    const { el } = render();
    expect(el.querySelector('.facts')?.textContent).toContain('Catch rate');
    const stats = el.querySelector('.stats')?.textContent ?? '';
    expect(stats).toContain('HP');
    expect(stats).toContain('Special');
    // The grid lists every ball against every status, and highlights the best non-Master ball.
    const grid = el.querySelector('table:not(.moves)');
    expect(grid?.textContent).toContain('Poké Ball');
    expect(grid?.textContent).toContain('Master Ball');
    expect(grid?.querySelector('td.best')).not.toBeNull();
    expect(el.textContent).toContain('Shiny if moved to Generation II');
  });

  it('links to both calculators for this species', () => {
    const { el } = render();
    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/red/tools/catch?dex=16');
    expect(links).toContain('/red/tools/ivs?dex=16');
  });

  it('explains an unknown species', () => {
    const { el } = render('missingno');
    expect(el.querySelector('.status')?.textContent).toContain('No Pokémon called');
  });
});
