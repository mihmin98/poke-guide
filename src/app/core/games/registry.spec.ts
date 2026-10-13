import { CONDITION_KINDS, formatCondition } from './conditions';
import { ENCOUNTER_METHODS, isKnownMethod } from './methods';
import {
  GAMES,
  VERSION_GROUPS,
  findGame,
  findGameByCodecId,
  getVersionGroup,
  groupGamesByGeneration,
  isGameId,
  listGames,
} from './registry';

describe('game registry', () => {
  it('has unique game ids and codec ids', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    expect(new Set(GAMES.map((g) => g.codecId)).size).toBe(GAMES.length);
  });

  it('keeps the published codec ids stable', () => {
    expect(findGame('red')?.codecId).toBe(1);
    expect(findGame('blue')?.codecId).toBe(2);
    expect(findGame('yellow')?.codecId).toBe(3);
    expect(findGameByCodecId(3)?.id).toBe('yellow');
    expect(findGame('gold')?.codecId).toBe(4);
    expect(findGame('silver')?.codecId).toBe(5);
    expect(findGame('crystal')?.codecId).toBe(6);
  });

  it('keeps the codec ids reserved for planned games', () => {
    const ids = [
      'ruby',
      'sapphire',
      'emerald',
      'firered',
      'leafgreen',
      'diamond',
      'pearl',
    ] as const;
    expect(ids.map((id) => findGame(id)?.codecId)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    const later = ['platinum', 'heartgold', 'soulsilver', 'black', 'white', 'black2', 'white2'];
    expect(later.map((id) => findGame(id)?.codecId)).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });

  it('uses codec ids that fit in a uint16', () => {
    for (const game of GAMES) {
      expect(Number.isInteger(game.codecId) && game.codecId > 0 && game.codecId <= 0xffff).toBe(
        true,
      );
    }
  });

  it('links every game to a version group of the same generation that lists it', () => {
    for (const game of GAMES) {
      const group = getVersionGroup(game.versionGroupId);
      expect(group.games).toContain(game.id);
      expect(group.generation).toBe(game.generation);
    }
    for (const group of VERSION_GROUPS) {
      for (const id of group.games) expect(findGame(id)?.versionGroupId).toBe(group.id);
    }
  });

  it('has valid accent seeds, regions, dex sizes and release years', () => {
    for (const game of GAMES) {
      expect(game.releaseYear).toBeGreaterThanOrEqual(1998);
      expect(game.accent.seed).toMatch(/^#[0-9a-f]{6}$/i);
      expect(game.regions.length).toBeGreaterThan(0);
      expect(game.nationalDexMax).toBeGreaterThan(0);
    }
  });

  it('ships Generations I and II as available', () => {
    expect(listGames({ includePlanned: false }).map((g) => g.id)).toEqual([
      'red',
      'blue',
      'yellow',
      'gold',
      'silver',
      'crystal',
    ]);
    expect(listGames({ includePlanned: true }).length).toBe(GAMES.length);
  });

  it('orders games by release, with the release year never going back', () => {
    const games = listGames({ includePlanned: true });
    expect(new Set(games.map((g) => g.releaseOrder)).size).toBe(games.length);
    games.slice(1).forEach((game, i) => {
      expect(game.releaseYear).toBeGreaterThanOrEqual(games[i]!.releaseYear);
    });
  });

  it('groups games by generation, one row per version group in order of first release', () => {
    const groups = groupGamesByGeneration(listGames({ includePlanned: true }));
    expect(groups.map((g) => g.generation)).toEqual([1, 2, 3, 4, 5]);
    expect(groups.map((g) => g.rows.map((row) => row.map((game) => game.id)))).toEqual([
      [['red', 'blue', 'yellow']],
      [['gold', 'silver', 'crystal']],
      [
        ['ruby', 'sapphire', 'emerald'],
        ['firered', 'leafgreen'],
      ],
      [
        ['diamond', 'pearl', 'platinum'],
        ['heartgold', 'soulsilver'],
      ],
      [
        ['black', 'white'],
        ['black2', 'white2'],
      ],
    ]);
  });

  it('puts Gold, Silver and Crystal in one Gen II version group', () => {
    expect(getVersionGroup('gsc').games).toEqual(['gold', 'silver', 'crystal']);
  });

  it('recognizes game ids', () => {
    expect(isGameId('yellow')).toBe(true);
    expect(isGameId('green')).toBe(false);
  });
});

describe('encounter method registry', () => {
  it('has unique ids and section orders', () => {
    expect(new Set(ENCOUNTER_METHODS.map((m) => m.id)).size).toBe(ENCOUNTER_METHODS.length);
    expect(new Set(ENCOUNTER_METHODS.map((m) => m.sectionOrder)).size).toBe(
      ENCOUNTER_METHODS.length,
    );
  });

  it('covers the methods used by Red, Blue and Yellow', () => {
    const rby = [
      'walk-grass',
      'walk-cave',
      'walk-building',
      'surf',
      'fish-old',
      'fish-good',
      'fish-super',
      'gift',
      'starter',
      'purchase',
      'prize',
      'trade',
      'static',
      'fossil',
      'special',
    ];
    for (const id of rby) expect(isKnownMethod(id)).toBe(true);
  });

  it('covers the methods used by Gold, Silver and Crystal', () => {
    for (const id of ['headbutt', 'rock-smash', 'bug-contest', 'roaming', 'egg']) {
      expect(isKnownMethod(id)).toBe(true);
    }
  });
});

describe('encounter conditions', () => {
  it('formats every condition kind', () => {
    expect(formatCondition({ kind: 'time', value: 'night' })).toBe('Night');
    expect(formatCondition({ kind: 'day-of-week', value: 'fri' })).toBe('Friday');
    expect(formatCondition({ kind: 'swarm' })).toBe('Swarm');
    expect(formatCondition({ kind: 'season', value: 'winter' })).toBe('Winter');
    expect(formatCondition({ kind: 'story', text: 'After becoming Champion' })).toBe(
      'After becoming Champion',
    );
    expect(Object.keys(CONDITION_KINDS).sort()).toEqual(
      ['day-of-week', 'season', 'story', 'swarm', 'time'].sort(),
    );
  });
});
