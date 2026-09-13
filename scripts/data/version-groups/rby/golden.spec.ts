/**
 * Golden assertions over the generated Red/Blue/Yellow data (plan §7.8, §7.11, §7.12). They read the files in
 * `public/data/`, so regenerate them with `npm run data:build` after changing the pipeline.
 * Still to add with their tasks: Game Corner windows (shop parser), Mew event-only and trade-evolution
 * unobtainability (overrides and obtainability).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameId, PokedexData, VersionGroupData } from '../../../../src/app/core/domain/models';
import { repoRoot } from '../../core/paths';
import { rbyConfig } from './config';
import { RBY_EVOLUTIONS } from './overrides/evolutions';

const read = <T>(file: string) =>
  JSON.parse(readFileSync(join(repoRoot(), 'public', 'data', file), 'utf8')) as T;
const data = read<VersionGroupData>('rby.json');
const pokedex = read<PokedexData>('rby.pokedex.json');

const encounters = (locationId: string, dex: number, subArea?: string) => {
  const location = data.locations.find((l) => l.id === locationId);
  if (!location) throw new Error(`No location ${locationId}`);
  return location.subAreas
    .filter((a) => subArea === undefined || a.id === subArea)
    .flatMap((a) => a.encounters.filter((e) => e.dex === dex));
};
const gamesOf = (locationId: string, dex: number, subArea?: string) =>
  encounters(locationId, dex, subArea).flatMap((e) => Object.keys(e.games) as GameId[]);
const species = (dex: number) => data.species.find((s) => s.dex === dex)!;

describe('rby data: structure', () => {
  it('has species #1–#151 in order, the 15 Generation I types and the override evolutions', () => {
    expect(data.species.map((s) => s.dex)).toEqual(Array.from({ length: 151 }, (_, i) => i + 1));
    expect(data.types).toHaveLength(15);
    expect(data.types).not.toContain('steel');
    expect(data.evolutions).toEqual(RBY_EVOLUTIONS);
  });

  it('has every configured location, in walkthrough order for each game', () => {
    expect(data.locations.map((l) => l.id)).toEqual(rbyConfig.locations.map((l) => l.id));
    for (const game of data.games) {
      const orders = data.locations.map((l) => l.placement[game]!.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it('only has encounters for species in range and games of the version group', () => {
    for (const location of data.locations) {
      for (const encounter of location.subAreas.flatMap((a) => a.encounters)) {
        expect(encounter.dex).toBeGreaterThanOrEqual(1);
        expect(encounter.dex).toBeLessThanOrEqual(151);
        for (const game of Object.keys(encounter.games)) expect(data.games).toContain(game);
      }
    }
  });

  it('lists every location page as a source', () => {
    const titles = new Set(data.sources.map((s) => s.title));
    for (const location of data.locations) expect(titles.has(location.source.title)).toBe(true);
  });
});

describe('rby data: encounters (plan §7.8)', () => {
  it('Route 1 Pidgey: Lv 2–5 at 50% in Red, Lv 2–7 at 70% in Yellow', () => {
    const [pidgey] = encounters('route-1', 16);
    expect(pidgey!.method).toBe('walk-grass');
    expect(pidgey!.games.red).toEqual([
      { levels: { min: 2, max: 5 }, rate: { kind: 'percent', value: 50 } },
    ]);
    expect(pidgey!.games.yellow).toEqual([
      { levels: { min: 2, max: 7 }, rate: { kind: 'percent', value: 70 } },
    ]);
  });

  it('Safari Zone Center Area: Scyther is Red-only, Pinsir is Blue-only', () => {
    expect(gamesOf('safari-zone', 123, 'center-area')).toEqual(['red']);
    expect(gamesOf('safari-zone', 127, 'center-area')).toEqual(['blue']);
  });

  it('Pokémon Tower 3F Gastly is Lv 18–24 in Red and Blue', () => {
    const [gastly] = encounters('pokemon-tower', 92, '3f');
    for (const game of ['red', 'blue'] as const) {
      expect(gastly!.games[game]![0]!.levels).toEqual({ min: 18, max: 24 });
    }
  });

  it('Silph Co. Lapras is a Lv 15 gift in all three games', () => {
    const [lapras] = encounters('silph-co', 131);
    expect(lapras!.method).toBe('gift');
    for (const game of data.games) {
      expect(lapras!.games[game]).toEqual([
        { levels: { min: 15, max: 15 }, rate: { kind: 'once' } },
      ]);
    }
  });

  it('Route 24 Charmander is a Yellow-only gift', () => {
    expect(encounters('route-24', 4).map((e) => [e.method, Object.keys(e.games)])).toEqual([
      ['gift', ['yellow']],
    ]);
  });
});

describe('rby data: species (plan §7.11, §7.12)', () => {
  it('uses Generation I catch rates, including per-game values', () => {
    expect(species(1).catchRate).toBe(45);
    expect(species(25).catchRate).toBe(190);
    expect(species(150).catchRate).toBe(3);
    expect(species(20)).toMatchObject({ catchRate: 90, catchRateNote: '127 from Generation III' });
    expect(species(148)).toMatchObject({ catchRate: 45, catchRateByGame: { yellow: 27 } });
    expect(species(64).catchRate).toBe(100);
    expect(species(64).catchRateByGame).toBeUndefined();
  });

  it('uses Generation I base stats and base experience', () => {
    expect(species(25).baseStats).toMatchObject({ def: 30, spc: 50 });
    expect(species(1).baseStats.spc).toBe(65);
    expect(species(25).baseExp).toBe(82);
  });
});

describe('rby pokédex data (plan §7.12)', () => {
  const learnset = (dex: number) => pokedex.learnsets[String(dex)]!;

  it('has Pikachu learn Thunder Wave at 9 in Red/Blue and 8 in Yellow, and Tail Whip only in Yellow', () => {
    expect(learnset(25).levelUp.find((r) => r.move === 'thunder-wave')!.levels).toEqual({
      red: 9,
      blue: 9,
      yellow: 8,
    });
    expect(Object.keys(learnset(25).levelUp.find((r) => r.move === 'tail-whip')!.levels)).toEqual([
      'yellow',
    ]);
  });

  it('has 164 learnable moves, 55 of them on TMs/HMs, and Mew learns them all', () => {
    const machines = pokedex.moves.filter((m) => m.machine);
    expect(pokedex.moves).toHaveLength(164);
    expect(machines).toHaveLength(55);
    expect([...learnset(151).machines].sort()).toEqual(machines.map((m) => m.id).sort());
  });

  it('keeps Generation I move data (Bite is Normal)', () => {
    expect(pokedex.moves.find((m) => m.id === 'bite')).toMatchObject({ type: 'normal', power: 60 });
  });

  it('has Pokédex entries for every species in every game', () => {
    for (const dex of data.species.map((s) => s.dex)) {
      const games = pokedex.entries[String(dex)]!.flatMap((e) => e.games);
      expect([...new Set(games)].sort()).toEqual(['blue', 'red', 'yellow']);
    }
  });
});
