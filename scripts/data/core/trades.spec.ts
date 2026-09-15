import type { Encounter, GameLocation } from '../../../src/app/core/domain/models';
import { fixture } from '../testing/fixtures';
import { rbyConfig } from '../version-groups/rby/config';
import { diffTrades, parseTradeTables } from './trades';

describe('parseTradeTables', () => {
  const result = parseTradeTables(fixture('rby', 'in-game-trade').wikitext, {
    pageTitle: 'In-game trade',
    generationHeading: 'Generation I',
    tables: rbyConfig.tradePage!.tables,
  });
  const forGame = (game: 'red' | 'yellow') =>
    result.trades
      .filter((t) => t.games.includes(game))
      .map((t) => [t.locationPage, t.giveDex, t.getDex, t.nickname]);

  it('reads the international Red/Blue and Yellow tables, skipping Japanese-only rows', () => {
    expect(result.issues).toEqual([]);
    expect(forGame('red')).toEqual([
      ['Kanto Route 2', 63, 122, 'MARCEL'],
      ['Underground Path (Kanto Routes 5–6)', 32, 29, 'SPOT'],
      ['Kanto Route 11', 33, 30, 'TERRY'],
      ['Kanto Route 18', 80, 108, 'MARC'],
      ['Cerulean City', 61, 124, 'LOLA'],
      ['Vermilion City', 21, 83, 'DUX'],
      ['Cinnabar Lab', 26, 101, 'DORIS'],
      ['Cinnabar Lab', 48, 114, 'CRINKLES'],
      ['Cinnabar Lab', 77, 86, 'SAILOR'],
    ]);
    expect(forGame('yellow')).toHaveLength(7);
    expect(forGame('yellow')[1]).toEqual(['Underground Path (Kanto Routes 5–6)', 104, 67, 'RICKY']);
  });
});

describe('diffTrades', () => {
  const encounter = (dex: number, giveDex: number, games: string[]): Encounter => ({
    dex,
    method: 'trade',
    trade: { giveDex },
    games: Object.fromEntries(games.map((g) => [g, [{ levels: null, rate: { kind: 'once' } }]])),
  });
  const location = (id: string, encounters: Encounter[]): GameLocation => ({
    id,
    name: id,
    region: 'kanto',
    kind: 'route',
    placement: {},
    source: { title: id, revid: 1 },
    notes: [],
    subAreas: [{ id: 'main', name: null, encounters }],
    items: [],
    itemNotes: [],
  });

  it('sets nicknames on matches and reports differences both ways', () => {
    const locations = [
      location('route-2', [encounter(122, 63, ['red', 'blue']), encounter(83, 21, ['red'])]),
    ];
    const result = diffTrades(
      locations,
      [
        {
          games: ['red', 'blue'],
          locationPage: 'Kanto Route 2',
          giveDex: 63,
          getDex: 122,
          nickname: 'MARCEL',
        },
        {
          games: ['yellow'],
          locationPage: 'Kanto Route 2',
          giveDex: 35,
          getDex: 122,
          nickname: 'MILES',
        },
        { games: ['red'], locationPage: 'Nowhere', giveDex: 1, getDex: 2, nickname: 'X' },
      ],
      new Map([['Kanto Route 2', 'route-2']]),
    );
    expect(result.errors).toEqual(['Trade for #2 names unknown location page "Nowhere"']);
    expect(result.warnings).toEqual([
      "route-2: trade page lists #35 → #122 in yellow, the location data doesn't",
      'route-2: #21 → #83 in red is not on the trade page',
    ]);
    expect(locations[0]!.subAreas[0]!.encounters[0]!.trade).toEqual({
      giveDex: 63,
      nickname: 'MARCEL',
    });
  });
});
