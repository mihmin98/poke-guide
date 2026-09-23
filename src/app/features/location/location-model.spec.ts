import { buildGameView } from '../../core/domain/game-view';
import type { LocationItem } from '../../core/domain/models';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import {
  buildItemRows,
  buildLocationView,
  catchDifficulty,
  catchRateFor,
  itemRequirementLabels,
} from './location-model';

const percent = (value: number, min = 2, max = 5) => [
  { levels: { min, max }, rate: { kind: 'percent' as const, value } },
];

const ITEM: LocationItem = {
  no: 1,
  itemId: 'rare-candy',
  name: 'Rare Candy',
  quantity: 1,
  games: ['red'],
  obtain: 'pickup',
  hidden: true,
  subArea: 'B1F',
  where: 'In the south-west corner',
  requires: [['cut-hm', 'surf-hm']],
};

function data() {
  return testData({
    games: ['red'],
    species: [
      testSpecies(16, { name: 'Pidgey' }),
      testSpecies(19, { name: 'Rattata', catchRate: 255 }),
      testSpecies(63, { name: 'Abra' }),
      testSpecies(122, { name: 'Mr. Mime' }),
      testSpecies(148, { name: 'Dragonair', catchRateByGame: { yellow: 27 } }),
    ],
    unlocks: {
      red: [
        { id: 'cut-hm', label: 'Cut', kind: 'move', locationId: 'a', part: 5 },
        { id: 'surf-hm', label: 'Surf', kind: 'move', locationId: 'a', part: 12 },
      ],
    },
    exclusiveGroups: [
      { id: 'mt-moon-fossil', label: 'Helix or Dome Fossil', games: ['red'], members: [138, 140] },
    ],
    locations: [
      testLocation('route-1', 1, [testEncounter(16, ['red'])], ['red']),
      testLocation(
        'route-2',
        2,
        [
          testEncounter(16, ['red'], { games: { red: percent(20) } }),
          testEncounter(19, ['red'], { games: { red: percent(45) } }),
          testEncounter(122, ['red'], {
            method: 'trade',
            trade: { giveDex: 63, nickname: 'MARCEL' },
          }),
        ],
        ['red'],
        { name: 'Route 2', items: [ITEM, { ...ITEM, itemId: 'potion', games: ['yellow'] }] },
      ),
      testLocation('route-3', 3, [testEncounter(19, ['red'])], ['red']),
    ],
  });
}

const build = (locationId: string, obtainable: number[] = [16, 19, 122]) =>
  buildLocationView({
    view: buildGameView(data(), 'red'),
    game: 'red',
    locationId,
    obtainable: new Set(obtainable),
  });

describe('location model (plan §13.5)', () => {
  it('returns nothing for a location that is not in this game', () => {
    expect(build('nowhere')).toBeUndefined();
  });

  it('sorts rows by rate, then by Dex number', () => {
    const rows = build('route-2')!.subAreas[0]!.sections[0]!.rows;
    expect(rows.map((r) => r.name)).toEqual(['Rattata', 'Pidgey']);
  });

  it('orders method sections by the registry sectionOrder', () => {
    const sections = build('route-2')!.subAreas[0]!.sections;
    expect(sections.map((s) => s.method.id)).toEqual(['walk-grass', 'trade']);
  });

  it('names the species a trade asks for and warns when you cannot get it', () => {
    const trade = build('route-2')!.subAreas[0]!.sections[1]!.rows[0]!;
    expect(trade.trade).toEqual({
      giveDex: 63,
      giveName: 'Abra',
      giveObtainable: false,
      nickname: 'MARCEL',
    });
    const reachable = build('route-2', [16, 19, 63, 122])!.subAreas[0]!.sections[1]!.rows[0]!;
    expect(reachable.trade!.giveObtainable).toBe(true);
  });

  it('links the previous and next location in walkthrough order', () => {
    const view = build('route-2')!;
    expect(view.previous?.id).toBe('route-1');
    expect(view.next?.id).toBe('route-3');
    expect(build('route-1')!.previous).toBeUndefined();
    expect(build('route-3')!.next).toBeUndefined();
  });

  it('keeps only the items this game has, and lists every species for "mark all"', () => {
    const view = build('route-2')!;
    expect(view.items.map((i) => i.itemId)).toEqual(['rare-candy']);
    expect(view.dexes.sort((a, b) => a - b)).toEqual([16, 19, 122]);
  });

  it('resolves the catch rate the capture actually uses', () => {
    const dragonair = { catchRate: 45, catchRateByGame: { yellow: 27 } };
    expect(catchRateFor(dragonair, 'red', undefined)).toBe(45);
    expect(catchRateFor(dragonair, 'yellow', undefined)).toBe(27);
    expect(
      catchRateFor(dragonair, 'yellow', {
        levels: null,
        rate: { kind: 'once' },
        catchRateOverride: 3,
      }),
    ).toBe(3);
    expect(catchRateFor(undefined, 'red', undefined)).toBeUndefined();
  });

  it('grades how hard a species is to catch', () => {
    expect([255, 120, 3].map(catchDifficulty)).toEqual(['easy', 'medium', 'hard']);
  });

  it('joins alternative item prerequisites into one chip', () => {
    expect(itemRequirementLabels(ITEM, (id) => (id === 'cut-hm' ? 'Cut' : 'Surf'))).toEqual([
      'Cut or Surf',
    ]);
    expect(itemRequirementLabels({ ...ITEM, requires: undefined }, (id) => id)).toEqual([]);
  });

  it('builds item rows with their picked-up state and the "hide items I have" filter', () => {
    const fossil = (no: number, name: string): LocationItem => ({
      ...ITEM,
      no,
      name,
      hidden: undefined,
      obtain: 'choice',
      choiceGroupId: 'fossil',
    });
    const items = [ITEM, fossil(2, 'Dome Fossil'), fossil(3, 'Helix Fossil')];
    const rows = (taken: number[], showHidden = true, hideTaken = false) =>
      buildItemRows(items, new Set(taken), { showHidden, hideTaken }).map((r) => [
        r.item.no,
        r.taken,
        r.chosenInstead ?? null,
      ]);
    expect(rows([])).toEqual([
      [1, false, null],
      [2, false, null],
      [3, false, null],
    ]);
    expect(rows([3])).toEqual([
      [1, false, null],
      [2, false, 'Helix Fossil'],
      [3, true, null],
    ]);
    expect(rows([3], false)).toEqual([
      [2, false, 'Helix Fossil'],
      [3, true, null],
    ]);
    expect(rows([3], true, true)).toEqual([[1, false, null]]);
  });
});
