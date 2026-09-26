import { GAMES } from '../../../src/app/core/games/registry';
import { fixture } from '../testing/fixtures';
import {
  baseExpIn,
  baseStatsIn,
  parseBaseStats,
  parseInfobox,
  parsePokedexEntries,
  pokedexEntriesForGames,
} from './species-pages';

const page = (name: string) => fixture('rby', name).wikitext;

describe('parseInfobox', () => {
  it('reads Bulbasaur', () => {
    expect(parseInfobox(page('bulbasaur'))).toEqual({
      dex: 1,
      name: 'Bulbasaur',
      category: 'Seed',
      heightM: 0.7,
      weightKg: 6.9,
      baseExp: 64,
      oldBaseExp: 64,
      growthRate: 'medium-slow',
      catchRate: 45,
      evYield: { spa: 1 },
      eggGroups: ['Monster', 'Grass'],
      genderCode: 31,
    });
  });

  it('reads Pikachu, whose base experience changed after Generation IV', () => {
    const info = parseInfobox(page('pikachu'));
    expect(info).toMatchObject({
      category: 'Mouse',
      catchRate: 190,
      growthRate: 'medium-fast',
      evYield: { spe: 2 },
    });
    expect(baseExpIn(info, 1)).toBe(82);
    expect(baseExpIn(info, 9)).toBe(112);
  });

  it('ignores footnote markers on numbers (Yanma)', () => {
    const text = page('pikachu').replace(/\|evsp=\d+/, '|evsp=1{{tt|*|2 in Generation III}}');
    expect(parseInfobox(text).evYield).toEqual({ spe: 1 });
  });

  it('uses the visible text of tooltip categories and the original form (Rattata)', () => {
    expect(parseInfobox(page('rattata')).category).toBe('Mouse');
  });
});

describe('parseBaseStats', () => {
  it('pairs blocks with generation-range headings (Pikachu)', () => {
    const blocks = parseBaseStats(page('pikachu'), 'Pikachu');
    expect(blocks.map((b) => [b.from, b.to])).toEqual([
      [1, 5],
      [6, Infinity],
    ]);
    expect(baseStatsIn(blocks, 1)).toEqual({ hp: 35, atk: 55, def: 30, spc: 50, spe: 90 });
    expect(baseStatsIn(blocks, 2)).toEqual({ hp: 35, atk: 55, def: 30, spa: 50, spd: 40, spe: 90 });
    expect(baseStatsIn(blocks, 6)).toMatchObject({ def: 40, spd: 50 });
  });

  it('skips Mega Evolution blocks and keeps the default form heading (Venusaur)', () => {
    const blocks = parseBaseStats(page('venusaur'), 'Venusaur');
    expect(blocks).toHaveLength(1);
    expect(baseStatsIn(blocks, 1)).toEqual({ hp: 80, atk: 82, def: 83, spc: 100, spe: 80 });
  });

  it('reads Bulbasaur and Rattata in Generation I', () => {
    expect(baseStatsIn(parseBaseStats(page('bulbasaur'), 'Bulbasaur'), 1)).toEqual({
      hp: 45,
      atk: 49,
      def: 49,
      spc: 65,
      spe: 45,
    });
    expect(baseStatsIn(parseBaseStats(page('rattata'), 'Rattata'), 1)).toMatchObject({
      hp: 30,
      spe: 72,
    });
  });

  it('accepts other stats templates and heading spellings', () => {
    const text = [
      '===Stats===',
      '====Base stats====',
      '=====Alakazam=====',
      '======Generation I to V======',
      '{{Stats|HP=55|Attack=50|Defense=45|SpAtk=135|SpDef=85|Speed=120|Special=135}}',
      '======Generation VI onwards======',
      '{{Stats|HP=55|Attack=50|Defense=45|SpAtk=135|SpDef=95|Speed=120}}',
      '=====Mega Alakazam=====',
      '======Generation VI======',
      '{{Base Stats|HP=55|Attack=50|Defense=65|SpAtk=175|SpDef=95|Speed=150}}',
    ].join('\n');
    const blocks = parseBaseStats(text, 'Alakazam');
    expect(blocks.map((b) => [b.from, b.to])).toEqual([
      [1, 5],
      [6, Infinity],
    ]);
    expect(
      baseStatsIn(
        parseBaseStats(
          '===Stats===\n====Base stats====\n{{BaseStats with RBY|HP=100|Attack=100|Defense=100|SpAtk=100|SpDef=100|Special=100|Speed=100}}',
          'Mew',
        ),
        1,
      ),
    ).toEqual({ hp: 100, atk: 100, def: 100, spc: 100, spe: 100 });
  });

  it('fails when no block covers the generation', () => {
    expect(() => baseStatsIn([{ from: 6, to: Infinity, stats: {} }], 1)).toThrow(
      /0 base stat blocks/,
    );
  });
});

describe('parsePokedexEntries', () => {
  const rby = GAMES.filter((g) => g.versionGroupId === 'rby');

  it('reads the Generation I entries and maps them to games', () => {
    const entries = pokedexEntriesForGames(parsePokedexEntries(page('bulbasaur'), 1), rby);
    expect(entries).toEqual([
      {
        games: ['red', 'blue'],
        text: 'A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.',
      },
      {
        games: ['yellow'],
        text: 'It can go for days without eating a single morsel. In the bulb on its back, it stores energy.',
      },
    ]);
  });

  it('keeps generations apart', () => {
    const gen2 = parsePokedexEntries(page('pikachu'), 2);
    expect(gen2.map((e) => e.versions)).toEqual([['Gold'], ['Silver'], ['Crystal'], ['Stadium 2']]);
  });
});
