/**
 * Golden assertions over the generated Gold/Silver/Crystal data (plan §7.8, §7.11–§7.14, §16 Phases 10–11). They read
 * the files in `public/data/`, so regenerate them with `npm run data:build` after changing the pipeline. Values were
 * checked against Bulbapedia and pret's pokegold and pokecrystal.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  GameId,
  ItemNote,
  PokedexData,
  VersionGroupData,
} from '../../../../src/app/core/domain/models';
import { buildGameView } from '../../../../src/app/core/domain/game-view';
import { buildJourney } from '../../../../src/app/core/domain/journey';
import { parseItemNumbers } from '../../core/item-numbers';
import { parseMilestoneNumbers } from '../../core/milestone-numbers';
import { repoRoot, versionGroupDir } from '../../core/paths';
import { gscConfig } from './config';
import { GSC_EVOLUTIONS } from './overrides/evolutions';

const read = <T>(file: string) =>
  JSON.parse(readFileSync(join(repoRoot(), 'public', 'data', file), 'utf8')) as T;
const data = read<VersionGroupData>('gsc.json');
const pokedex = read<PokedexData>('gsc.pokedex.json');

const location = (id: string) => {
  const found = data.locations.find((l) => l.id === id);
  if (!found) throw new Error(`No location ${id}`);
  return found;
};
const encounters = (locationId: string, dex?: number) =>
  location(locationId).subAreas.flatMap((a) =>
    a.encounters
      .filter((e) => dex === undefined || e.dex === dex)
      .map((e) => ({ ...e, subArea: a.id })),
  );
const gamesOf = (locationId: string, dex: number, method: string) =>
  encounters(locationId, dex)
    .filter((e) => e.method === method)
    .flatMap((e) => Object.keys(e.games) as GameId[]);
const species = (dex: number) => data.species.find((s) => s.dex === dex)!;

describe('gsc data: structure', () => {
  it('has species #1–#251 in order, the 17 Generation II types and the override evolutions', () => {
    expect(data.species.map((s) => s.dex)).toEqual(Array.from({ length: 251 }, (_, i) => i + 1));
    expect(data.types).toHaveLength(17);
    expect(data.types).toEqual(expect.arrayContaining(['dark', 'steel']));
    // Curse's ??? is a move-only type and never a filter.
    expect(data.types).not.toContain('unknown');
    expect(data.evolutions).toEqual(GSC_EVOLUTIONS);
  });

  it('has every configured location in Crystal walkthrough order, the Battle Tower in Crystal only', () => {
    expect(data.locations.map((l) => l.id)).toEqual(gscConfig.locations.map((l) => l.id));
    const orders = data.locations.map((l) => l.placement.crystal!.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(Object.keys(location('battle-tower').placement)).toEqual(['crystal']);
    expect(location('tin-tower').placement).toEqual({
      gold: { part: 29, order: 2900 },
      silver: { part: 29, order: 2900 },
      crystal: { part: 12, order: 1200 },
    });
  });

  it('only has encounters for species in range and games of the version group', () => {
    for (const { dex, games } of data.locations.flatMap((l) =>
      l.subAreas.flatMap((a) => a.encounters),
    )) {
      expect(dex).toBeGreaterThanOrEqual(1);
      expect(dex).toBeLessThanOrEqual(251);
      for (const game of Object.keys(games)) expect(data.games).toContain(game);
    }
  });

  it('lists every location page as a source', () => {
    const titles = new Set(data.sources.map((s) => s.title));
    for (const { source } of data.locations) expect(titles.has(source.title)).toBe(true);
  });
});

describe('gsc data: encounters (plan §7.8)', () => {
  it('Route 29: keeps per-time rates, with Hoothoot only at night', () => {
    const [pidgey] = encounters('route-29', 16).filter((e) => e.method === 'walk-grass');
    expect(pidgey!.games.gold).toEqual([
      {
        levels: { min: 2, max: 4 },
        rate: { kind: 'percent', value: 55 },
        conditions: [{ kind: 'time', value: 'morning' }],
      },
      {
        levels: { min: 2, max: 4 },
        rate: { kind: 'percent', value: 55 },
        conditions: [{ kind: 'time', value: 'day' }],
      },
    ]);
    expect(pidgey!.games.crystal!.map((s) => s.rate)).toEqual([
      { kind: 'percent', value: 50 },
      { kind: 'percent', value: 50 },
    ]);
    const [hoothoot] = encounters('route-29', 163).filter((e) => e.method === 'walk-grass');
    expect(hoothoot!.games.gold).toEqual([
      {
        levels: { min: 2, max: 4 },
        rate: { kind: 'percent', value: 85 },
        conditions: [{ kind: 'time', value: 'night' }],
      },
    ]);
  });

  it('collapses equal morning/day/night rates into one slot (New Bark Town Tentacool)', () => {
    const [surf] = encounters('new-bark-town', 72).filter((e) => e.method === 'surf');
    expect(surf!.games.gold).toEqual([
      { levels: { min: 15, max: 24 }, rate: { kind: 'percent', value: 90 } },
    ]);
  });

  it('Ilex Forest: Caterpie in Gold and Crystal, Weedle in Silver and Crystal', () => {
    expect(gamesOf('ilex-forest', 10, 'walk-grass')).toEqual(['gold', 'crystal']);
    expect(gamesOf('ilex-forest', 13, 'walk-grass')).toEqual(['silver', 'crystal']);
  });

  it('marks swarms, Headbutt trees and the Bug-Catching Contest', () => {
    const yanma = encounters('route-35', 193).map((e) => e.games.gold![0]!);
    expect(yanma.map((s) => [s.rate, s.conditions ?? []])).toEqual([
      [{ kind: 'percent', value: 1 }, []],
      [{ kind: 'percent', value: 30 }, [{ kind: 'swarm' }]],
    ]);
    const headbutt = encounters('route-29').filter((e) => e.method === 'headbutt');
    expect(headbutt.length).toBeGreaterThan(0);
    expect(headbutt.every((e) => e.requires?.includes('headbutt'))).toBe(true);
    expect(
      encounters('national-park')
        .filter((e) => e.method === 'bug-contest')
        .map((e) => e.dex),
    ).toEqual([10, 11, 12, 13, 14, 15, 46, 48, 123, 127]);
  });

  it('has Unown in every game inside the Ruins of Alph', () => {
    expect(gamesOf('ruins-of-alph', 201, 'walk-cave')).toEqual(['gold', 'silver', 'crystal']);
  });
});

describe('gsc data: encounter overrides (plan §7.7)', () => {
  const only = (locationId: string, dex: number, method: string) => {
    const found = encounters(locationId, dex).filter((e) => e.method === method);
    expect(found).toHaveLength(1);
    return found[0]!;
  };
  const levels = (e: ReturnType<typeof only>) =>
    Object.fromEntries(Object.entries(e.games).map(([g, slots]) => [g, slots[0]!.levels!.min]));

  it('makes the Elm’s Lab gifts a starter choice, and Crystal’s Odd Egg a random exclusive group', () => {
    expect(data.exclusiveGroups.map((g) => [g.id, g.games, g.members])).toEqual([
      ['gsc-starter', ['gold', 'silver', 'crystal'], [152, 155, 158]],
      ['odd-egg', ['crystal'], [172, 173, 174, 236, 238, 239, 240]],
    ]);
    expect(
      encounters('new-bark-town')
        .filter((e) => e.method === 'starter')
        .map((e) => [e.dex, e.exclusiveGroupId]),
    ).toEqual([
      [152, 'gsc-starter'],
      [155, 'gsc-starter'],
      [158, 'gsc-starter'],
    ]);
    expect(only('route-34', 172, 'egg')).toMatchObject({
      label: 'Odd Egg',
      exclusiveGroupId: 'odd-egg',
    });
    expect(Object.keys(only('route-34', 172, 'egg').games)).toEqual(['crystal']);
  });

  it('has Mew and Celebi as event-only, and the Kanto-only species as Time Capsule transfers', () => {
    expect(data.eventOnly).toEqual([151, 251]);
    expect(data.requiresOtherGame).toEqual([
      {
        dex: [1, 2, 3, 4, 5, 6, 7, 8, 9, 138, 139, 140, 141, 144, 145, 146, 150],
        detail: 'Transfer from Red, Blue or Yellow through the Time Capsule',
      },
    ]);
    expect(data.breeding).toEqual({ dayCareLocationIds: ['route-34'], dittoDex: 132 });
  });

  it('has Lugia and Ho-Oh at 40 in their own game, 70 in the other and 60 in Crystal', () => {
    const lugia = only('whirl-islands', 249, 'static');
    expect(levels(lugia)).toEqual({ silver: 40, gold: 70, crystal: 60 });
    expect(lugia.requires).toEqual(['surf', 'whirlpool', 'silver-wing']);
    const hoOh = only('tin-tower', 250, 'static');
    expect(levels(hoOh)).toEqual({ gold: 40, silver: 70, crystal: 60 });
    expect(hoOh.requires).toEqual(['rainbow-wing']);
  });

  it('has the beasts roam from the Burned Tower, with Crystal’s Suicune waiting in Tin Tower', () => {
    expect(
      encounters('burned-tower')
        .filter((e) => e.method === 'roaming')
        .map((e) => [e.dex, e.subArea, Object.keys(e.games)]),
    ).toEqual([
      [243, 'b1f', ['gold', 'silver', 'crystal']],
      [244, 'b1f', ['gold', 'silver', 'crystal']],
      [245, 'b1f', ['gold', 'silver']],
    ]);
    const suicune = only('tin-tower', 245, 'static');
    expect([suicune.subArea, levels(suicune), suicune.requires]).toEqual([
      '1f',
      { crystal: 40 },
      ['clear-bell'],
    ]);
  });

  it('has the Red Gyarados always Shiny with fixed DVs, and the Friday Lapras', () => {
    const gyarados = only('lake-of-rage', 130, 'static');
    expect(gyarados.label).toBe('Red Gyarados');
    for (const game of data.games) {
      expect(gyarados.games[game]![0]).toMatchObject({
        levels: { min: 30, max: 30 },
        ivs: { kind: 'fixed', values: { hp: 0, atk: 14, def: 10, spe: 10, spc: 10 } },
        shiny: 'guaranteed',
      });
    }
    const lapras = only('union-cave', 131, 'static');
    expect([lapras.subArea, lapras.requires, lapras.games.gold![0]!.conditions]).toEqual([
      'b2f',
      ['surf'],
      [{ kind: 'day-of-week', value: 'fri' }],
    ]);
  });

  it('has the gifts with pret levels, Crystal’s Dratini behind the Dragon Shrine test', () => {
    expect(levels(only('violet-city', 175, 'egg'))).toEqual({ gold: 5, silver: 5, crystal: 5 });
    expect(levels(only('goldenrod-city', 133, 'gift'))).toEqual({
      gold: 20,
      silver: 20,
      crystal: 20,
    });
    expect(levels(only('cianwood-city', 213, 'gift'))).toEqual({
      gold: 15,
      silver: 15,
      crystal: 15,
    });
    expect(levels(only('mt-mortar', 236, 'gift'))).toEqual({ gold: 10, silver: 10, crystal: 10 });
    const dratini = only('dragons-den', 147, 'gift');
    expect([levels(dratini), dratini.requires]).toEqual([{ crystal: 15 }, ['surf', 'whirlpool']]);
    expect(only('route-36', 185, 'static').requires).toEqual(['squirtbottle']);
    expect(only('vermilion-city', 143, 'static').requires).toEqual(['expn-card']);
  });
});

describe('gsc data: prizes and trades (plan §7.7)', () => {
  const prizes = (locationId: string, game: GameId) =>
    encounters(locationId)
      .filter((e) => e.method === 'prize' && e.games[game])
      .map((e) => {
        const slot = e.games[game]![0]!;
        return [e.dex, slot.levels!.min, slot.rate.kind === 'coins' ? slot.rate.value : null];
      });

  it('has the Goldenrod Game Corner prizes per game (pret GoldenrodGameCorner.asm)', () => {
    expect(prizes('goldenrod-game-corner', 'gold')).toEqual([
      [63, 10, 200],
      [23, 10, 700],
      [147, 10, 2100],
    ]);
    expect(prizes('goldenrod-game-corner', 'silver')).toEqual([
      [63, 10, 200],
      [147, 10, 2100],
      [27, 10, 700],
    ]);
    expect(prizes('goldenrod-game-corner', 'crystal')).toEqual([
      [63, 5, 100],
      [104, 15, 800],
      [202, 15, 1500],
    ]);
    expect(
      encounters('goldenrod-game-corner').every((e) => e.requires?.includes('coin-case')),
    ).toBe(true);
  });

  it('has the Celadon Game Corner prizes per game', () => {
    expect(prizes('celadon-game-corner', 'gold')).toEqual([
      [122, 15, 3333],
      [133, 15, 6666],
      [137, 20, 9999],
    ]);
    expect(prizes('celadon-game-corner', 'crystal')).toEqual([
      [137, 15, 5555],
      [25, 25, 2222],
      [246, 40, 8888],
    ]);
  });

  it('names every in-game trade, with its fixed DVs: six in Gold and Silver, seven in Crystal', () => {
    const trades = data.locations
      .flatMap((l) => l.subAreas.flatMap((a) => a.encounters))
      .filter((e) => e.method === 'trade');
    for (const [game, count] of [
      ['gold', 6],
      ['silver', 6],
      ['crystal', 7],
    ] as const) {
      expect(trades.filter((e) => e.games[game])).toHaveLength(count);
    }
    expect(trades.every((e) => e.trade?.nickname)).toBe(true);
    expect(
      trades.every((e) => Object.values(e.games).every((slots) => slots[0]!.ivs?.kind === 'fixed')),
    ).toBe(true);
    expect(
      encounters('goldenrod-department-store')
        .filter((e) => e.method === 'trade')
        .map((e) => [e.dex, e.trade, Object.keys(e.games)]),
    ).toEqual([
      [66, { giveDex: 96, nickname: 'MUSCLE' }, ['gold', 'silver']],
      [66, { giveDex: 63, nickname: 'MUSCLE' }, ['crystal']],
    ]);
  });
});

describe('gsc data: items (plan §7.13)', () => {
  const items = (locationId: string) => location(locationId).items;
  const find = (locationId: string, itemId: string) =>
    items(locationId).filter((i) => i.itemId === itemId);
  const noteText = (note: ItemNote) => (typeof note === 'string' ? note : note.text);

  it('has per-game item totals, including the overrides', () => {
    const all = data.locations.flatMap((l) => l.items);
    expect(
      Object.fromEntries(data.games.map((g) => [g, all.filter((i) => i.games.includes(g)).length])),
    ).toEqual({ gold: 332, silver: 332, crystal: 379 });
  });

  it('adds the Gym leader TMs and the Radio Tower rewards from Part 12', () => {
    expect(find('violet-city', 'tm31-mud-slap')[0]).toMatchObject({
      subArea: 'Gym',
      obtain: 'reward',
    });
    expect(
      items('goldenrod-radio-tower')
        .filter((i) => i.fromPart)
        .map((i) => [i.itemId, i.games]),
    ).toEqual([
      ['tm11-sunny-day', ['gold', 'silver', 'crystal']],
      ['pink-bow', ['gold', 'silver', 'crystal']],
      ['basement-key', ['gold', 'silver', 'crystal']],
      ['rainbow-wing', ['gold']],
      ['silver-wing', ['silver']],
      ['clear-bell', ['crystal']],
    ]);
  });

  it('gates items behind field moves, and buys the Game Corner TMs with coins', () => {
    expect(find('dragons-den', 'tm24-dragonbreath')[0]!.requires).toEqual([
      ['surf'],
      ['whirlpool'],
    ]);
    expect(find('lake-of-rage', 'red-scale')[0]!.requires).toEqual([['surf']]);
    expect(
      items('goldenrod-game-corner').map((i) => [i.name, i.obtain, i.coins, i.requires]),
    ).toEqual([
      ['TM25 Thunder', 'purchase', 5500, [['coin-case']]],
      ['TM14 Blizzard', 'purchase', 5500, [['coin-case']]],
      ['TM38 Fire Blast', 'purchase', 5500, [['coin-case']]],
    ]);
  });

  it('keeps per-game spots apart and makes "Given by" rows gifts', () => {
    expect(find('lake-of-rage', 'elixer').map((i) => i.games)).toEqual([['crystal'], ['crystal']]);
    expect(find('lake-of-rage', 'max-ether').map((i) => i.games)).toEqual([['gold', 'silver']]);
    expect(find('new-bark-town', 'pokegear')[0]).toMatchObject({
      where: 'Given by Mom at the start of the game',
      obtain: 'gift',
    });
  });

  it('turns recurring sources into location notes, naming their games when not all have them', () => {
    expect(location('route-31').itemNotes).toContainEqual({
      text: 'Phone gift: Berry — Sometimes given out by Bug Catcher Wade if the player has his number',
      games: ['crystal'],
    });
    expect(location('violet-city').itemNotes!.map(noteText)).toEqual([
      'Daily tree: PRZCureBerry — On the Berry tree near the exit to Route 32',
    ]);
    expect(location('goldenrod-radio-tower').itemNotes!.map(noteText)).toContain(
      'Lottery prize: Master Ball — Pokémon ID matched perfectly',
    );
  });

  it('only requires unlocks of the item’s games, and lists walkthrough pages as sources', () => {
    for (const item of data.locations.flatMap((l) => l.items)) {
      for (const id of (item.requires ?? []).flat()) {
        for (const game of item.games) expect(data.unlocks[game]!.map((u) => u.id)).toContain(id);
      }
    }
    const titles = data.sources.map((s) => s.title);
    expect(titles).toContain('Walkthrough:Pokémon Crystal/Part 12');
    expect(titles).toContain('Walkthrough:Pokémon Gold and Silver/Part 29');
  });

  it('numbers every item as the committed registry does (plan §7.13, Phase 9)', () => {
    const registry = parseItemNumbers(
      readFileSync(join(versionGroupDir('gsc'), 'item-numbers.json'), 'utf8'),
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
    expect(find('new-bark-town', 'pokegear')[0]!.no).toBe(1);
    expect(find('violet-city', 'tm31-mud-slap')[0]!.no).toBe(38);
    expect(find('lake-of-rage', 'red-scale')[0]!.no).toBe(251);
    expect(find('dragons-den', 'dragon-fang')[0]!.no).toBe(311);
  });
});

describe('gsc data: species (plan §7.11)', () => {
  it('uses Generation II base stats with the Special split, catch rates and types', () => {
    expect(species(25).baseStats).toEqual({ hp: 35, atk: 55, def: 30, spa: 50, spd: 40, spe: 90 });
    expect(species(249)).toMatchObject({ catchRate: 3, types: ['psychic', 'flying'] });
    expect(species(201).catchRate).toBe(225);
    // The Clefairy line is Normal until Generation VI.
    expect(species(35).types).toEqual(['normal']);
    expect(species(208).types).toEqual(['steel', 'ground']);
  });

  it('has gender ratios as fractions, egg groups and New Pokédex numbers (pret dex_order_new.asm)', () => {
    expect(species(152)).toMatchObject({ genderRatio: 0.125, eggGroups: ['Monster', 'Grass'] });
    expect(species(236).genderRatio).toBe(0);
    expect(species(201).genderRatio).toBe('genderless');
    expect(species(132).eggGroups).toEqual(['Ditto']);
    expect([152, 25, 201, 143, 249, 251].map((dex) => species(dex).regionalDex?.crystal)).toEqual([
      1, 22, 61, 225, 247, 251,
    ]);
  });
});

describe('gsc pokédex data (plan §7.12)', () => {
  const learnset = (dex: number) => pokedex.learnsets[String(dex)]!;

  it('has 250 learnable moves, 57 of them on TMs/HMs, and Mew learns them all', () => {
    const machines = pokedex.moves.filter((m) => m.machine);
    expect(pokedex.moves).toHaveLength(250);
    expect(machines).toHaveLength(57);
    expect([...learnset(151).machines].sort()).toEqual(machines.map((m) => m.id).sort());
  });

  it('keeps Generation II move data (Bite is Dark, Curse is ???)', () => {
    expect(pokedex.moves.find((m) => m.id === 'bite')).toMatchObject({ type: 'dark', power: 60 });
    expect(pokedex.moves.find((m) => m.id === 'curse')).toMatchObject({
      type: 'unknown',
      machine: 'TM03',
    });
  });

  it('has per-game egg and tutor moves, and Smeargle only learns Sketch', () => {
    expect(learnset(1).egg).toContainEqual({ move: 'charm', games: ['gold', 'silver'] });
    expect(learnset(25).tutor).toEqual([{ move: 'thunderbolt', games: ['crystal'] }]);
    expect(new Set(learnset(235).levelUp.map((r) => r.move))).toEqual(new Set(['sketch']));
    expect(learnset(235).machines).toEqual([]);
  });

  it('has Pokédex entries for every species in every game', () => {
    for (const dex of data.species.map((s) => s.dex)) {
      const games = pokedex.entries[String(dex)]!.flatMap((e) => e.games);
      expect([...new Set(games)].sort()).toEqual(['crystal', 'gold', 'silver']);
    }
  });
});

describe('gsc data: story milestones (plan §7.14)', () => {
  const milestones = data.milestones ?? [];
  const inGame = (game: GameId) => milestones.filter((m) => m.part[game] !== undefined);
  const byId = (id: string) => milestones.find((m) => m.id === id)!;

  it('has the 16 gyms with their badges in walkthrough order in every game', () => {
    for (const game of data.games) {
      const gyms = inGame(game).filter((m) => m.kind === 'gym');
      expect(gyms.map((m) => m.badge)).toEqual([
        'Zephyr',
        'Hive',
        'Plain',
        'Fog',
        'Storm',
        'Mineral',
        'Glacier',
        'Rising',
        'Thunder',
        'Marsh',
        'Cascade',
        'Rainbow',
        'Soul',
        'Boulder',
        'Volcano',
        'Earth',
      ]);
      const parts = gyms.map((m) => m.part[game]!);
      expect(parts).toEqual([...parts].sort((a, b) => a - b));
    }
  });

  it('has the Elite Four and Lance at Indigo Plateau in Part 15, and Red at Mt. Silver in Part 28', () => {
    for (const game of data.games) {
      const league = inGame(game).filter((m) => m.locationId === 'indigo-plateau');
      expect(league.map((m) => [m.id, m.part[game]])).toEqual([
        ['elite-four-will', 15],
        ['elite-four-koga', 15],
        ['elite-four-bruno', 15],
        ['elite-four-karen', 15],
        ['champion', 15],
      ]);
    }
    expect(byId('red')).toMatchObject({
      locationId: 'mt-silver-cave',
      part: { gold: 28, silver: 28, crystal: 28 },
    });
    expect(byId('red').optional).toBeUndefined();
  });

  it("gives each game the Director's own reward and the other wing from Pewter City", () => {
    const granting = (game: GameId, unlock: string) =>
      inGame(game)
        .filter((m) => m.grants?.includes(unlock))
        .map((m) => m.id);
    expect(granting('gold', 'rainbow-wing')).toEqual(['director-rainbow-wing']);
    expect(granting('gold', 'silver-wing')).toEqual(['pewter-silver-wing']);
    expect(granting('silver', 'silver-wing')).toEqual(['director-silver-wing']);
    expect(granting('silver', 'rainbow-wing')).toEqual(['pewter-rainbow-wing']);
    expect(granting('crystal', 'clear-bell')).toEqual(['director-clear-bell']);
    expect(granting('crystal', 'silver-wing')).toEqual(['pewter-silver-wing']);
    expect(granting('crystal', 'rainbow-wing')).toEqual(['wise-trio-rainbow-wing']);
    // Crystal-only unlocks on milestones every game has.
    expect(granting('crystal', 'ho-oh')).toEqual(['ho-oh']);
    expect(granting('crystal', 'water-stone')).toEqual(['bills-grandfather']);
    expect(Object.keys(byId('ho-oh').part)).toEqual(['gold', 'silver', 'crystal']);
  });

  it("has Crystal's own events, and Suicune where each game meets it", () => {
    const crystalOnly = milestones.filter((m) => Object.keys(m.part).join() === 'crystal');
    expect(crystalOnly.map((m) => m.id)).toEqual([
      'receive-odd-egg',
      'eusine-cianwood',
      'director-clear-bell',
      'wise-trio',
      'suicune-tin-tower',
      'receive-dratini',
      'wise-trio-rainbow-wing',
    ]);
    expect(milestones.filter((m) => m.dex === 245).map((m) => [m.locationId, m.part])).toEqual([
      ['burned-tower', { gold: 8, silver: 8 }],
      ['tin-tower', { crystal: 12 }],
    ]);
    expect(byId('sudowoodo')).toMatchObject({ locationId: 'route-36', dex: 185 });
    expect(byId('red-gyarados')).toMatchObject({ locationId: 'lake-of-rage', dex: 130 });
    expect(inGame('gold')).toHaveLength(92);
    expect(inGame('silver')).toHaveLength(92);
    expect(inGame('crystal')).toHaveLength(97);
  });

  it('numbers every milestone as the committed registry does', () => {
    const registry = parseMilestoneNumbers(
      readFileSync(join(versionGroupDir('gsc'), 'milestone-numbers.json'), 'utf8'),
    );
    const numbered = milestones.map(({ no, id }) => ({ no, id }));
    expect([...numbered].sort((a, b) => a.no - b.no)).toEqual(registry.milestones);
    expect(registry.next).toBeGreaterThan(Math.max(...numbered.map((m) => m.no)));
    // Spot checks: these numbers are stored in profiles and export codes, so they must never move.
    expect(byId('choose-starter').no).toBe(1);
    expect(byId('gym-falkner').no).toBe(6);
    expect(byId('champion').no).toBe(72);
    expect(byId('red').no).toBe(96);
  });
});

describe('gsc data: the Story and Guide journey (plan §13.13)', () => {
  const steps = (game: GameId, part: number) =>
    (buildJourney(buildGameView(data, game), game).find((p) => p.part === part)?.steps ?? []).map(
      (s) =>
        s.kind === 'area'
          ? s.location.id
          : s.kind === 'milestone'
            ? `${s.milestone.id}${s.revisit ? '↩' : ''}`
            : 'opens',
    );

  it('starts Part 12 in the Goldenrod Radio Tower, as the walkthrough does', () => {
    for (const game of data.games) {
      const part12 = steps(game, 12);
      expect(part12.slice(0, 2)).toEqual(['radio-tower-fake-director↩', 'opens']);
      expect(part12).toContain('rescue-director↩');
    }
  });

  it('goes back to Olivine for Jasmine after Cianwood, before Route 42', () => {
    const part10 = steps('crystal', 10);
    expect(part10.indexOf('gym-jasmine↩')).toBeGreaterThan(part10.indexOf('gym-chuck'));
    expect(part10.indexOf('gym-jasmine↩')).toBeLessThan(part10.indexOf('route-42'));
  });

  it('wakes Snorlax before Route 11 in Part 23', () => {
    expect(steps('gold', 23).slice(0, 2)).toEqual(['snorlax↩', 'route-11']);
  });
});
