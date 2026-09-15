import { buildGameView, encountersFor } from './game-view';
import { ONCE, testData, testEncounter, testLocation } from './testing/test-data';

describe('buildGameView', () => {
  const data = testData({
    games: ['red', 'blue', 'yellow'],
    locations: [
      testLocation('late', 5, [], ['red', 'yellow']),
      testLocation('early', 2, [], ['red', 'blue', 'yellow']),
      testLocation('yellow-only', 1, [], ['yellow']),
    ],
    evolutions: [
      { from: 1, to: 2, trigger: 'level', level: 16, requiresTrade: false },
      {
        from: 1,
        to: 3,
        trigger: 'item',
        item: 'moon-stone',
        requiresTrade: false,
        games: ['yellow'],
      },
      { from: 4, to: 5, trigger: 'trade', requiresTrade: true },
    ],
    exclusiveGroups: [
      { id: 'starter', label: 'Starter', games: ['red', 'blue'], members: [1, 4] },
      { id: 'fossil', label: 'Fossil', games: ['red', 'blue', 'yellow'], members: [4, 7] },
    ],
    unlocks: { red: [{ id: 'surf', label: 'Surf', kind: 'move', locationId: 'early', part: 2 }] },
    walkthroughs: { red: [{ part: 2, title: 'Part 2', region: 'kanto' }] },
  });

  it('keeps only this game’s locations, in walkthrough order', () => {
    expect(buildGameView(data, 'red').locations.map((l) => l.id)).toEqual(['early', 'late']);
    expect(buildGameView(data, 'yellow').locations.map((l) => l.id)).toEqual([
      'yellow-only',
      'early',
      'late',
    ]);
    expect(buildGameView(data, 'blue').locationById.has('late')).toBe(false);
  });

  it('indexes species by dex and slug', () => {
    const view = buildGameView(data, 'red');
    expect(view.speciesByDex.get(3)?.name).toBe('Mon3');
    expect(view.speciesBySlug.get('mon7')?.dex).toBe(7);
  });

  it('indexes evolutions and exclusive groups that apply to the game', () => {
    const red = buildGameView(data, 'red');
    expect(red.evolutionsFrom.get(1)?.map((e) => e.to)).toEqual([2]);
    expect(red.evolutionsTo.get(5)?.map((e) => e.from)).toEqual([4]);
    expect(red.groupsByDex.get(4)?.map((g) => g.id)).toEqual(['starter', 'fossil']);

    const yellow = buildGameView(data, 'yellow');
    expect(yellow.evolutionsFrom.get(1)?.map((e) => e.to)).toEqual([2, 3]);
    expect(yellow.groupsByDex.get(4)?.map((g) => g.id)).toEqual(['fossil']);
    expect(yellow.groupsByDex.has(1)).toBe(false);
  });

  it('returns per-game unlocks and walkthrough, empty when absent', () => {
    expect(buildGameView(data, 'red').unlocks.map((u) => u.id)).toEqual(['surf']);
    expect(buildGameView(data, 'red').walkthrough).toHaveLength(1);
    expect(buildGameView(data, 'blue').unlocks).toEqual([]);
    expect(buildGameView(data, 'blue').walkthrough).toEqual([]);
  });
});

describe('encountersFor', () => {
  const location = testLocation('cave', 3, [], ['red', 'yellow'], {
    subAreas: [
      {
        id: '1f',
        name: '1F',
        encounters: [
          testEncounter(1, ['red'], { method: 'fish-old', requires: ['old-rod'] }),
          testEncounter(2, ['red', 'yellow']),
          testEncounter(3, ['red'], { method: 'static' }),
          testEncounter(4, ['yellow']),
          testEncounter(5, ['red']),
        ],
      },
      { id: '2f', name: '2F', encounters: [testEncounter(6, ['yellow'])] },
    ],
  });

  it('groups a game’s encounters by sub-area and method section order', () => {
    const red = encountersFor(location, 'red');
    expect(red.map((s) => s.id)).toEqual(['1f']);
    expect(red[0]!.sections.map((s) => [s.method.id, s.encounters.map((e) => e.dex)])).toEqual([
      ['walk-grass', [2, 5]],
      ['fish-old', [1]],
      ['static', [3]],
    ]);
  });

  it('narrows slots to the game and keeps encounter details', () => {
    const [fishing] = encountersFor(location, 'red')[0]!.sections.filter(
      (s) => s.method.id === 'fish-old',
    );
    expect(fishing!.encounters[0]).toEqual({
      dex: 1,
      method: 'fish-old',
      requires: ['old-rod'],
      slots: ONCE,
    });
    expect(
      encountersFor(location, 'yellow').map((s) => [
        s.name,
        s.sections[0]!.encounters.map((e) => e.dex),
      ]),
    ).toEqual([
      ['1F', [2, 4]],
      ['2F', [6]],
    ]);
  });

  it('returns nothing for a game without encounters here', () => {
    expect(encountersFor(location, 'blue')).toEqual([]);
  });
});
