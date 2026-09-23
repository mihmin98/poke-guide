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

  it('has valid accent seeds, regions and dex sizes', () => {
    for (const game of GAMES) {
      expect(game.accent.seed).toMatch(/^#[0-9a-f]{6}$/i);
      expect(game.regions.length).toBeGreaterThan(0);
      expect(game.nationalDexMax).toBeGreaterThan(0);
    }
  });

  it('ships Red, Blue and Yellow as available', () => {
    expect(listGames({ includePlanned: false }).map((g) => g.id)).toEqual([
      'red',
      'blue',
      'yellow',
    ]);
    expect(listGames({ includePlanned: true }).length).toBe(GAMES.length);
  });

  it('groups games by generation in ascending order', () => {
    const groups = groupGamesByGeneration(listGames({ includePlanned: true }));
    expect(groups.map((g) => g.generation)).toEqual([1, 2, 3]);
    expect(groups[0]?.games.map((g) => g.id)).toEqual(['red', 'blue', 'yellow']);
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
