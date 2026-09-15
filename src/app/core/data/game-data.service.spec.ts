import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PokedexData } from '../domain/models';
import { testData, testEncounter, testLocation } from '../domain/testing/test-data';
import { GameDataService } from './game-data.service';

describe('GameDataService', () => {
  let service: GameDataService;
  let http: HttpTestingController;

  const data = testData({
    games: ['red', 'blue', 'yellow'],
    species: testData()
      .species.slice(0, 3)
      .map((s) => ({ ...s })),
    locations: [
      testLocation('route-2', 2, [testEncounter(2, ['red'])], ['red', 'blue']),
      testLocation(
        'route-1',
        1,
        [testEncounter(1, ['red', 'yellow']), testEncounter(3, ['red'], { method: 'surf' })],
        ['red', 'yellow'],
      ),
    ],
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GameDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function settle() {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  it('shares one request per version group and exposes per-game views', async () => {
    const red = service.forGame('red');
    const yellow = service.forGame('yellow');
    expect(service.forGame('red')).toBe(red);
    expect(red.locations()).toEqual([]);

    TestBed.tick();
    http.expectOne('data/rby.json').flush(data);
    await settle();

    expect(red.isLoading()).toBe(false);
    expect(red.locations().map((l) => l.id)).toEqual(['route-1', 'route-2']);
    expect(yellow.locations().map((l) => l.id)).toEqual(['route-1']);
    expect(red.speciesBySlug().get('mon2')?.dex).toBe(2);
    expect(red.encountersFor('route-1').flatMap((s) => s.sections.map((x) => x.method.id))).toEqual(
      ['walk-grass', 'surf'],
    );
    expect(yellow.encountersFor('route-2')).toEqual([]);
  });

  it('computes the checklist for the game (species 1..nationalDexMax)', async () => {
    const red = service.forGame('red');
    TestBed.tick();
    http.expectOne('data/rby.json').flush(data);
    await settle();

    const entries = red.checklist();
    expect(entries).toHaveLength(151);
    expect(entries.filter((e) => e.obtainable).map((e) => e.dex)).toEqual([1, 2, 3]);
    expect(red.maxInOneSave()).toBe(3);
  });

  it('reports a file for the wrong version group or schema as an error', async () => {
    const red = service.forGame('red');
    TestBed.tick();
    http.expectOne('data/rby.json').flush({ ...data, versionGroupId: 'gsc' });
    await settle();

    expect(red.error()).toBeInstanceOf(Error);
    expect(red.locations()).toEqual([]);
    expect(red.checklist()).toEqual([]);
  });

  it('loads the Pokédex file only on demand, once per version group', async () => {
    const red = service.forGame('red');
    TestBed.tick();
    http.expectOne('data/rby.json').flush(data);
    await settle();
    http.expectNone('data/rby.pokedex.json');

    const pokedex = red.pokedex();
    expect(service.forGame('blue').pokedex()).toBe(pokedex);
    TestBed.tick();
    const file: PokedexData = {
      schemaVersion: 1,
      versionGroupId: 'rby',
      builtAt: '',
      moves: [],
      learnsets: {},
      entries: {},
      sources: [],
    };
    http.expectOne('data/rby.pokedex.json').flush(file);
    await settle();
    expect(pokedex.value()).toEqual(file);
  });
});
