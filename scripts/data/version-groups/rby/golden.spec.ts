/**
 * Golden assertions over the generated Red/Blue/Yellow data (plan §7.8, §7.11, §7.12). They read the files in
 * `public/data/`, so regenerate them with `npm run data:build` after changing the pipeline.
 * Still to add with their tasks: Game Corner windows (shop parser), Mew event-only and trade-evolution
 * unobtainability (overrides and obtainability).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGameView } from '../../../../src/app/core/domain/game-view';
import { buildJourney, type JourneyPart } from '../../../../src/app/core/domain/journey';
import type { GameId, PokedexData, VersionGroupData } from '../../../../src/app/core/domain/models';
import { parseItemNumbers } from '../../core/item-numbers';
import { parseMilestoneNumbers } from '../../core/milestone-numbers';
import { repoRoot, versionGroupDir } from '../../core/paths';
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

  it("Professor Oak's Lab has the starters: Bulbasaur/Charmander/Squirtle in Red/Blue, Pikachu in Yellow", () => {
    for (const dex of [1, 4, 7]) expect(gamesOf('oaks-lab', dex)).toEqual(['red', 'blue']);
    expect(gamesOf('oaks-lab', 25)).toEqual(['yellow']);
    expect(gamesOf('pallet-town', 1)).toEqual([]);
  });

  it('Route 24 Charmander is a Yellow-only gift', () => {
    expect(encounters('route-24', 4).map((e) => [e.method, Object.keys(e.games)])).toEqual([
      ['gift', ['yellow']],
    ]);
  });
});

describe('rby data: encounter overrides (plan §7.7)', () => {
  const at = (locationId: string) =>
    data.locations
      .find((l) => l.id === locationId)!
      .subAreas.flatMap((s) => s.encounters.map((e) => ({ ...e, subArea: s.id })));

  it('makes the Oak’s Lab first partners starters, with the Red/Blue choice as an exclusive group', () => {
    expect(at('oaks-lab').map((e) => [e.dex, e.method, e.exclusiveGroupId ?? null])).toEqual([
      [1, 'starter', 'rby-starter'],
      [4, 'starter', 'rby-starter'],
      [7, 'starter', 'rby-starter'],
      [25, 'starter', null],
    ]);
    expect(at('route-1').some((e) => e.dex === 25)).toBe(false);
  });

  it('adds the statics with pret levels and their requirements', () => {
    const find = (locationId: string, dex: number) =>
      at(locationId).find((e) => e.dex === dex && e.method === 'static')!;
    const summary = (locationId: string, dex: number) => {
      const e = find(locationId, dex);
      return [e.subArea, e.games.yellow![0]!.levels!.min, e.requires, Object.keys(e.games)];
    };
    expect(summary('route-12', 143)).toEqual([
      'main',
      30,
      ['poke-flute'],
      ['red', 'blue', 'yellow'],
    ]);
    expect(summary('route-16', 143)).toEqual([
      'main',
      30,
      ['poke-flute'],
      ['red', 'blue', 'yellow'],
    ]);
    expect(summary('seafoam-islands', 144)).toEqual([
      'b4f',
      50,
      ['surf', 'strength'],
      ['red', 'blue', 'yellow'],
    ]);
    expect(summary('power-plant', 145)).toEqual(['main', 50, ['surf'], ['red', 'blue', 'yellow']]);
    expect(summary('power-plant', 100)[1]).toBe(40);
    expect(summary('power-plant', 101)[1]).toBe(43);
    expect(summary('victory-road', 146)).toEqual([
      '2f',
      50,
      ['strength'],
      ['red', 'blue', 'yellow'],
    ]);
    expect(summary('cerulean-cave', 150)).toEqual([
      'b1f',
      70,
      ['post-game'],
      ['red', 'blue', 'yellow'],
    ]);
  });

  it('has the exclusive groups on their encounters, and Mew as event-only', () => {
    expect(data.exclusiveGroups.map((g) => [g.id, g.members])).toEqual([
      ['rby-starter', [1, 4, 7]],
      ['mt-moon-fossil', [138, 140]],
      ['fighting-dojo', [106, 107]],
    ]);
    expect(
      at('cinnabar-lab')
        .filter((e) => e.method === 'fossil')
        .map((e) => [e.dex, e.exclusiveGroupId ?? null]),
    ).toEqual([
      [138, 'mt-moon-fossil'],
      [140, 'mt-moon-fossil'],
      [142, null],
    ]);
    expect(at('fighting-dojo').map((e) => e.exclusiveGroupId)).toEqual([
      'fighting-dojo',
      'fighting-dojo',
    ]);
    expect(data.eventOnly).toEqual([151]);
  });
});

describe('rby data: items (plan §7.13)', () => {
  const items = (locationId: string) => data.locations.find((l) => l.id === locationId)!.items;
  const find = (locationId: string, itemId: string) =>
    items(locationId).filter((i) => i.itemId === itemId);

  it('has per-game item totals, including the overrides', () => {
    const all = data.locations.flatMap((l) => l.items);
    expect(
      Object.fromEntries(data.games.map((g) => [g, all.filter((i) => i.games.includes(g)).length])),
    ).toEqual({
      red: 219,
      blue: 219,
      yellow: 224,
    });
  });

  it('parses stated prerequisites, trainer drops and alternatives', () => {
    expect(find('route-12', 'tm16-pay-day')[0]).toMatchObject({
      requires: [['surf']],
      obtain: 'pickup',
    });
    expect(find('team-rocket-hideout', 'silph-scope')[0]).toMatchObject({
      obtain: 'drop',
      requires: [['lift-key']],
    });
    expect(find('route-25', 'tm19-seismic-toss')[0]!.requires).toEqual([
      ['route-25-jr-trainer', 'cut'],
    ]);
  });

  it('keeps per-game spots apart (Viridian Forest) and splits bulleted spots (Mt. Moon)', () => {
    expect(find('viridian-forest', 'antidote').map((i) => i.games)).toEqual([
      ['red', 'blue', 'yellow'],
      ['red', 'blue'],
    ]);
    expect(find('viridian-forest', 'potion').map((i) => i.games)).toEqual([
      ['yellow'],
      ['red', 'blue', 'yellow'],
      ['red', 'blue', 'yellow'],
    ]);
    expect(find('mt-moon', 'potion').map((i) => i.quantity)).toEqual([1, 1]);
    expect(
      items('mt-moon')
        .filter((i) => i.obtain === 'choice')
        .map((i) => [i.itemId, i.choiceGroupId]),
    ).toEqual([
      ['dome-fossil', 'mt-moon-fossil'],
      ['helix-fossil', 'mt-moon-fossil'],
    ]);
  });

  it('has Game Corner coins and the Power Plant fake item balls', () => {
    expect(find('celadon-game-corner', 'coins')).toHaveLength(14);
    expect(data.locations.find((l) => l.id === 'power-plant')!.itemNotes).toEqual([
      'Fake item balls: Voltorb ×6',
      'Fake item balls: Electrode ×2',
    ]);
  });

  it('buys the Game Corner TM prizes with coins', () => {
    expect(
      items('celadon-game-corner')
        .filter((i) => i.obtain === 'purchase')
        .map((i) => [i.name, i.coins, i.subArea, i.games.length]),
    ).toEqual([
      ['TM23 Dragon Rage', 3300, 'Prize corner', 3],
      ['TM15 Hyper Beam', 5500, 'Prize corner', 3],
      ['TM50 Substitute', 7700, 'Prize corner', 3],
    ]);
    expect(find('celadon-game-corner', 'tm23-dragon-rage')[0]!.requires).toEqual([['coin-case']]);
  });

  it('adds Gym leader and rooftop TMs from their source pages, and walkthrough-only gates', () => {
    expect(find('viridian-city', 'tm27-fissure')[0]).toMatchObject({
      subArea: 'Gym',
      obtain: 'reward',
      fromPart: { red: 14, blue: 14, yellow: 14 },
      source: { title: 'Walkthrough:Pokémon Red and Blue/Part 2' },
    });
    expect(find('vermilion-city', 'tm24-thunderbolt')[0]!.requires).toEqual([['cut']]);
    expect(items('celadon-department-store').map((i) => i.name)).toEqual([
      'TM18 Counter',
      'TM13 Ice Beam',
      'TM48 Rock Slide',
      'TM49 Tri Attack',
    ]);
    expect(find('silph-co', 'tm03-swords-dance')[0]!.requires).toEqual([['card-key']]);
    expect(find('victory-road', 'tm43-sky-attack')[0]!.requires).toEqual([['strength']]);
    expect(items('sea-cottage').map((i) => i.name)).toEqual(['S.S. Ticket']);
    expect(find('viridian-city', 'revive')[0]).toMatchObject({
      subArea: 'Gym',
      fromPart: { red: 14, blue: 14, yellow: 14 },
    });
    expect(find('pallet-town', 'potion')[0]).toMatchObject({
      obtain: 'gift',
      subArea: "Player's house",
    });
  });

  it('patches the Route 15 aide item to the Gen I name', () => {
    expect(find('route-15', 'exp-share')).toEqual([]);
    expect(find('route-15', 'exp-all')[0]).toMatchObject({ name: 'Exp. All', obtain: 'gift' });
  });

  it('only requires unlocks of the item’s games, and lists walkthrough pages as sources', () => {
    for (const item of data.locations.flatMap((l) => l.items)) {
      for (const id of (item.requires ?? []).flat()) {
        for (const game of item.games) expect(data.unlocks[game]!.map((u) => u.id)).toContain(id);
      }
    }
    const titles = data.sources.map((s) => s.title);
    expect(titles).toContain('Walkthrough:Pokémon Yellow/Part 17');
    expect(titles).toContain('Celadon Department Store');
  });

  it('numbers every item as the committed registry does (plan §7.13, Phase 9)', () => {
    const registry = parseItemNumbers(
      readFileSync(join(versionGroupDir('rby'), 'item-numbers.json'), 'utf8'),
    );
    const numbered = data.locations.flatMap((l) =>
      l.items.map((i) => ({
        no: i.no,
        locationId: l.id,
        subArea: i.subArea,
        itemId: i.itemId,
        where: i.where,
      })),
    );
    expect([...numbered].sort((a, b) => a.no - b.no)).toEqual(registry.items);
    expect(registry.next).toBeGreaterThan(Math.max(...numbered.map((i) => i.no)));
    // Spot checks: these numbers are stored in profiles and export codes, so they must never move.
    expect(find('pallet-town', 'town-map')[0]!.no).toBe(1);
    expect(find('mt-moon', 'dome-fossil')[0]!.no).toBe(31);
    expect(find('route-12', 'tm16-pay-day')[0]!.no).toBe(165);
    const b1f = find('cerulean-cave', 'ultra-ball').filter((i) => i.subArea === 'B1F');
    expect(b1f.map((i) => i.no)).toEqual([218, 219, 227, 228]);
  });
});

describe('rby data: story milestones (plan §7.14)', () => {
  const milestones = data.milestones ?? [];
  const inGame = (game: GameId) => milestones.filter((m) => m.part[game] !== undefined);
  const byId = (id: string) => milestones.find((m) => m.id === id)!;

  it('has the 8 gyms with their badges in walkthrough order in every game', () => {
    for (const game of data.games) {
      const gyms = inGame(game).filter((m) => m.kind === 'gym');
      expect(gyms.map((m) => m.badge)).toEqual([
        'Boulder',
        'Cascade',
        'Thunder',
        'Rainbow',
        'Marsh',
        'Soul',
        'Volcano',
        'Earth',
      ]);
      const parts = gyms.map((m) => m.part[game]!);
      expect(parts).toEqual([...parts].sort((a, b) => a - b));
    }
  });

  it('has the Elite Four and the Champion at Indigo Plateau in Part 16', () => {
    for (const game of data.games) {
      const part16 = inGame(game).filter((m) => m.part[game] === 16);
      expect(part16.map((m) => m.id)).toEqual([
        'elite-four-lorelei',
        'elite-four-bruno',
        'elite-four-agatha',
        'elite-four-lance',
        'champion',
      ]);
      expect(part16.every((m) => m.locationId === 'indigo-plateau')).toBe(true);
      expect(byId('champion').grants).toEqual(['post-game']);
    }
  });

  it('has the story encounters and gifts where the encounters are', () => {
    expect(byId('mewtwo')).toMatchObject({
      locationId: 'cerulean-cave',
      dex: 150,
      part: { red: 17, blue: 17, yellow: 17 },
    });
    expect(byId('receive-lapras')).toMatchObject({ locationId: 'silph-co', dex: 131 });
    expect(milestones.filter((m) => m.dex === 143).map((m) => m.locationId)).toEqual([
      'route-16',
      'route-12',
    ]);
  });

  it('gives Yellow its own starter, gifts and Jessie & James battles', () => {
    const yellowOnly = milestones.filter((m) => Object.keys(m.part).join() === 'yellow');
    expect(yellowOnly.map((m) => m.id)).toEqual([
      'receive-pikachu',
      'jessie-james-mt-moon',
      'receive-bulbasaur',
      'receive-charmander',
      'receive-squirtle',
      'jessie-james-rocket-hideout',
      'jessie-james-pokemon-tower',
      'jessie-james-silph-co',
    ]);
    expect(byId('choose-starter').part).toEqual({ red: 1, blue: 1 });
    expect(inGame('red')).toHaveLength(52);
    expect(inGame('yellow')).toHaveLength(59);
  });

  it('numbers every milestone as the committed registry does', () => {
    const registry = parseMilestoneNumbers(
      readFileSync(join(versionGroupDir('rby'), 'milestone-numbers.json'), 'utf8'),
    );
    const numbered = milestones.map(({ no, id }) => ({ no, id }));
    expect([...numbered].sort((a, b) => a.no - b.no)).toEqual(registry.milestones);
    expect(registry.next).toBeGreaterThan(Math.max(...numbered.map((m) => m.no)));
    // Spot checks: these numbers are stored in profiles and export codes, so they must never move.
    expect(byId('choose-starter').no).toBe(1);
    expect(byId('gym-brock').no).toBe(6);
    expect(byId('champion').no).toBe(59);
    expect(byId('mewtwo').no).toBe(60);
  });
});

describe('rby data: prizes and trades (plan §7.7)', () => {
  const encounters = (locationId: string) =>
    data.locations.find((l) => l.id === locationId)!.subAreas.flatMap((s) => s.encounters);

  it('has the Game Corner prizes per game, with coins, levels and the Coin Case', () => {
    const prizes = encounters('celadon-game-corner').filter((e) => e.method === 'prize');
    const forGame = (game: 'red' | 'blue' | 'yellow') =>
      prizes
        .filter((e) => e.games[game])
        .map((e) => e.dex)
        .sort((a, b) => a - b);
    expect(forGame('red')).toEqual([30, 35, 63, 123, 137, 147]);
    expect(forGame('blue')).toEqual([33, 35, 63, 127, 137, 147]);
    expect(forGame('yellow')).toEqual([37, 40, 63, 123, 127, 137]);
    const abra = prizes.find((e) => e.dex === 63)!;
    expect(abra.requires).toEqual(['coin-case']);
    expect(abra.games.red).toEqual([
      { levels: { min: 9, max: 9 }, rate: { kind: 'coins', value: 180 } },
    ]);
    expect(abra.games.yellow).toEqual([
      { levels: { min: 15, max: 15 }, rate: { kind: 'coins', value: 230 } },
    ]);
  });

  it('names every in-game trade from the trade page', () => {
    const trades = data.locations
      .flatMap((l) => l.subAreas.flatMap((s) => s.encounters))
      .filter((e) => e.method === 'trade');
    expect(trades).toHaveLength(16);
    expect(trades.every((e) => e.trade?.nickname)).toBe(true);
    expect(
      encounters('route-2')
        .filter((e) => e.method === 'trade')
        .map((e) => e.trade),
    ).toEqual([
      { giveDex: 63, nickname: 'MARCEL' },
      { giveDex: 35, nickname: 'MILES' },
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

describe('rby data: the Story and Guide journey (plan §13.13)', () => {
  const journeys = new Map(
    data.games.map((game) => [game, buildJourney(buildGameView(data, game), game)]),
  );
  const steps = (game: GameId, part: number) =>
    (journeys.get(game)!.find((p) => p.part === part)?.steps ?? []).map((s) =>
      s.kind === 'area'
        ? s.location.id
        : s.kind === 'milestone'
          ? `${s.milestone.id}${s.revisit ? '↩' : ''}`
          : `opens(${s.areas.map((a) => a.location.id).join(',')})`,
    );

  it("takes Flash on Route 2 after Diglett's Cave in Part 7", () => {
    for (const game of data.games)
      expect(steps(game, 7)).toEqual([
        'route-11',
        'digletts-cave',
        'hm05-flash↩',
        'pewter-museum',
        'route-9',
        'route-10',
      ]);
  });

  it("delivers Oak's Parcel after Viridian City", () => {
    expect(steps('red', 2).slice(0, 3)).toEqual(['route-1', 'viridian-city', 'oaks-parcel↩']);
  });

  it('keeps Sabrina after Silph Co.', () => {
    const part10 = steps('red', 10);
    expect(part10.indexOf('gym-sabrina')).toBeGreaterThan(part10.indexOf('silph-co'));
    expect(part10.indexOf('silph-co')).toBeGreaterThan(part10.indexOf('saffron-city'));
  });

  it('opens the earlier Surf items when Surf arrives', () => {
    const part11 = steps('red', 11);
    expect(part11[part11.indexOf('hm03-surf') + 1]).toBe(
      'opens(vermilion-city,celadon-city,safari-zone)',
    );
  });

  it('releases the Viridian Gym items with Giovanni', () => {
    expect(steps('red', 14)).toEqual([
      'power-plant',
      'zapdos',
      'gym-giovanni↩',
      'opens(viridian-city)',
    ]);
  });

  it('places every location and milestone of the game exactly once', () => {
    for (const game of data.games) {
      const all = journeys.get(game)!.flatMap((p: JourneyPart) => p.steps);
      const areas = all.flatMap((s) => (s.kind === 'area' ? [s.location.id] : []));
      const milestones = all.flatMap((s) => (s.kind === 'milestone' ? [s.milestone.id] : []));
      expect(areas).toEqual(buildGameView(data, game).locations.map((l) => l.id));
      expect(milestones).toEqual(buildGameView(data, game).milestones.map((m) => m.id));
    }
  });
});
