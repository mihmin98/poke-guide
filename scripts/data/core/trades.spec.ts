import type { Encounter, GameLocation } from '../../../src/app/core/domain/models';
import { fixture } from '../testing/fixtures';
import { gscConfig } from '../version-groups/gsc/config';
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

describe('parseTradeTables (Generation II)', () => {
  const result = parseTradeTables(fixture('gsc', 'in-game-trade').wikitext, {
    pageTitle: 'In-game trade',
    generationHeading: 'Generation II',
    tables: gscConfig.tradePage!.tables,
  });

  it('splits two-row trades by cell color and fills in the cells spanning both rows', () => {
    expect(result.issues).toEqual([]);
    expect(
      result.trades.map((t) => [t.locationPage, t.giveDex, t.getDex, t.nickname, t.games]),
    ).toEqual([
      ['Violet City', 69, 95, 'ROCKY', ['gold', 'silver', 'crystal']],
      ['Goldenrod Department Store', 96, 66, 'MUSCLE', ['gold', 'silver']],
      ['Goldenrod Department Store', 63, 66, 'MUSCLE', ['crystal']],
      ['Olivine City', 98, 100, 'VOLTY', ['gold', 'silver', 'crystal']],
      ['Blackthorn City', 148, 112, 'DON', ['gold', 'silver']],
      ['Blackthorn City', 148, 85, 'DORIS', ['crystal']],
      ['Kanto Route 14', 113, 142, 'AEROY', ['gold', 'silver', 'crystal']],
      ['Pewter City', 44, 78, 'RUNNY', ['gold', 'silver']],
      ['Pewter City', 93, 178, 'PAUL', ['crystal']],
      ['Kanto Power Plant', 51, 82, 'MAGGIE', ['crystal']],
    ]);
  });

  it('reads the fixed DVs, matching pret npc_trades.asm', () => {
    const dvs = Object.fromEntries(result.trades.map((t) => [t.nickname, t.ivs]));
    // ROCKY $96 $66: Attack 9, Defense 6, Speed 6, Special 6, so HP 8.
    expect(dvs['ROCKY']).toEqual({ hp: 8, atk: 9, def: 6, spe: 6, spc: 6 });
    expect(dvs['MUSCLE']).toEqual({ hp: 12, atk: 3, def: 7, spe: 6, spc: 6 });
    expect(dvs['PAUL']).toEqual({ hp: 8, atk: 9, def: 6, spe: 8, spc: 6 });
    expect(result.trades.every((t) => t.ivs)).toBe(true);
  });

  it('rejects a DV cell that is malformed or whose HP DV disagrees', () => {
    const table = gscConfig.tradePage!.tables[0]!;
    const page = (dvs: string) =>
      [
        '===Generation II===',
        `====${table.heading}====`,
        '{|',
        '|-',
        '| [[Violet City]]',
        '| {{MSP/3|069|Bellsprout}}',
        '| {{p|Bellsprout}}',
        '| {{MSP/3|095|Onix}}',
        '| {{p|Onix}}',
        '| ROCKY',
        `| ${dvs}`,
        '|}',
      ].join('\n');
    const parse = (dvs: string) =>
      parseTradeTables(page(dvs), {
        pageTitle: 'In-game trade',
        generationHeading: 'Generation II',
        tables: [table],
      });
    expect(parse('8/9/6/6/6').trades[0]?.ivs).toEqual({ hp: 8, atk: 9, def: 6, spe: 6, spc: 6 });
    expect(parse('9/9/6/6/6').issues[0]?.message).toContain("HP DV that doesn't match");
    expect(parse('8/9/6/6').issues[0]?.message).toContain('is not 5 DVs');
    expect(parse('8/9/6/6/16').issues[0]?.message).toContain('above 15');
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

  it('puts a trade’s fixed DVs on the matching games’ slots', () => {
    const locations = [location('violet-city', [encounter(95, 69, ['gold', 'crystal'])])];
    const ivs = { hp: 8, atk: 9, def: 6, spe: 6, spc: 6 };
    diffTrades(
      locations,
      [
        {
          games: ['gold'],
          locationPage: 'Violet City',
          giveDex: 69,
          getDex: 95,
          nickname: 'ROCKY',
          ivs,
        },
      ],
      new Map([['Violet City', 'violet-city']]),
    );
    const games = locations[0]!.subAreas[0]!.encounters[0]!.games;
    expect(games.gold![0]!.ivs).toEqual({ kind: 'fixed', values: ivs });
    expect(games.crystal![0]!.ivs).toBeUndefined();
  });
});
