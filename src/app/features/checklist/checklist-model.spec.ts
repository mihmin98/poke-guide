import { buildGameView } from '../../core/domain/game-view';
import { buildChecklist } from '../../core/domain/obtainability';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import {
  buildChecklistView,
  categoryOf,
  obtainCategoryLabel,
  unobtainableLabel,
  type ChecklistFilters,
  type ChecklistInput,
} from './checklist-model';

const GAME = { id: 'red', nationalDexMax: 7 } as const;
const FEATURES = { breeding: false } as never;

/**
 * Seven species: 1 → 2 by level (wild on route-1), 3 given at route-2, 4 traded for 3, 6 evolves from 5
 * only by trade, and 7 is Blue-only.
 */
function data() {
  return testData({
    games: ['red', 'blue'],
    types: ['normal', 'water'],
    species: [
      testSpecies(1, { name: 'Alpha', slug: 'alpha', regionalDex: { red: 4 } }),
      testSpecies(2, { name: 'Beta', slug: 'beta', types: ['water'], regionalDex: { red: 3 } }),
      testSpecies(3, { name: 'Gamma', slug: 'gamma', regionalDex: { red: 2 } }),
      testSpecies(4, { name: 'Delta', slug: 'delta', regionalDex: { red: 1 } }),
      testSpecies(5, { name: 'Epsilon', slug: 'epsilon' }),
      testSpecies(6, { name: 'Zeta', slug: 'zeta' }),
      testSpecies(7, { name: 'Eta', slug: 'eta' }),
    ],
    evolutions: [
      { from: 1, to: 2, trigger: 'level', level: 16, requiresTrade: false },
      { from: 5, to: 6, trigger: 'trade', requiresTrade: true },
    ],
    walkthroughs: {
      red: [
        { part: 1, title: 'Pallet Town', region: 'kanto' },
        { part: 2, title: 'Viridian City', region: 'kanto' },
      ],
    },
    exclusiveGroups: [{ id: 'starter', label: 'Starter choice', games: ['red'], members: [3] }],
    locations: [
      testLocation('route-1', 1, [testEncounter(1, ['red', 'blue'])], ['red', 'blue'], {
        name: 'Route 1',
      }),
      testLocation(
        'route-2',
        2,
        [
          testEncounter(3, ['red', 'blue'], { method: 'gift', exclusiveGroupId: 'starter' }),
          testEncounter(4, ['red', 'blue'], { method: 'trade', trade: { giveDex: 3 } }),
          testEncounter(5, ['red', 'blue']),
          testEncounter(7, ['blue']),
        ],
        ['red', 'blue'],
        { name: 'Route 2' },
      ),
    ],
  });
}

const FILTERS: ChecklistFilters = {
  status: 'all',
  search: '',
  types: new Set(),
  categories: new Set(),
  onlyAvailable: false,
  sort: 'national',
};

function build(overrides: Partial<ChecklistInput> = {}, filters: Partial<ChecklistFilters> = {}) {
  const raw = data();
  return buildChecklistView({
    view: buildGameView(raw, 'red'),
    game: 'red',
    entries: buildChecklist(raw, GAME, FEATURES),
    caught: new Set([1]),
    ...overrides,
    filters: { ...FILTERS, ...filters },
  });
}

describe('checklist model (plan §13.6)', () => {
  it('lists obtainable species with their sources and keeps the rest for the unobtainable section', () => {
    const view = build();
    expect(view.rows.map((r) => r.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']);
    expect(view.unobtainable.map((r) => r.name)).toEqual(['Zeta', 'Eta']);
    expect(view.unobtainable[0]!.unobtainableReason).toBe('trade-evolution');
    expect(view.unobtainable[1]!.unobtainableReason).toBe('other-version');
  });

  it('describes the earliest source of each species', () => {
    const view = build();
    expect(view.rows[0]!.earliest).toMatchObject({
      label: 'Route 1',
      detail: 'Grass',
      locationId: 'route-1',
      part: 1,
    });
    expect(view.rows[1]!.earliest).toMatchObject({ label: 'Evolves from Alpha', detail: 'Lv 16' });
    expect(view.rows[3]!.earliest).toMatchObject({
      label: 'Route 2',
      detail: 'Trade for Gamma',
      part: 2,
    });
  });

  it('carries the exclusive group label through evolutions and direct sources', () => {
    expect(build().rows[2]!.exclusiveGroupLabels).toEqual(['Starter choice']);
  });

  it('counts caught, obtainable and traded-in species', () => {
    const view = build({ caught: new Set([1, 7]) });
    expect(view.summary).toMatchObject({ caught: 1, obtainable: 5, caughtExtra: 1 });
    expect(view.summary.byType.find((t) => t.type === 'water')).toEqual({
      type: 'water',
      caught: 0,
      total: 1,
    });
  });

  it('passes the max in one save through to the summary', () => {
    expect(build({ maxInOneSave: 3 }).summary.maxInOneSave).toBe(3);
  });

  it('offers only the obtain categories this game actually has', () => {
    expect(build().categories).toEqual(['wild', 'evolution', 'gift', 'trade']);
    expect(obtainCategoryLabel('evolution')).toBe('Evolve');
  });

  it('filters by status, search, type and category', () => {
    expect(build({}, { status: 'caught' }).rows.map((r) => r.dex)).toEqual([1]);
    expect(build({}, { status: 'missing' }).rows.map((r) => r.dex)).toEqual([2, 3, 4, 5]);
    expect(build({}, { search: 'gam' }).rows.map((r) => r.dex)).toEqual([3]);
    expect(build({}, { search: '#004' }).rows.map((r) => r.dex)).toEqual([4]);
    expect(build({}, { search: '2' }).rows.map((r) => r.dex)).toEqual([2]);
    expect(build({}, { types: new Set(['water']) }).rows.map((r) => r.dex)).toEqual([2]);
    expect(build({}, { categories: new Set(['trade']) }).rows.map((r) => r.dex)).toEqual([4]);
  });

  it('"Available now" keeps species with a source up to the progress part', () => {
    const view = build({ progressPart: 1 }, { onlyAvailable: true });
    expect(view.rows.map((r) => r.dex)).toEqual([1, 2]);
    // Without a progress part the filter does nothing.
    expect(build({}, { onlyAvailable: true }).rows).toHaveLength(5);
  });

  it('sorts by National Dex, Regional Dex or walkthrough order', () => {
    expect(build({}, { sort: 'national' }).rows.map((r) => r.dex)).toEqual([1, 2, 3, 4, 5]);
    expect(build({}, { sort: 'regional' }).rows.map((r) => r.dex)).toEqual([4, 3, 2, 1, 5]);
    expect(build({}, { sort: 'walkthrough' }).rows.map((r) => r.dex)).toEqual([1, 2, 3, 4, 5]);
  });

  it('exposes the filtered dex numbers for the bulk actions', () => {
    expect(build({}, { status: 'missing' }).filteredDexes).toEqual([2, 3, 4, 5]);
  });

  it('maps a source to the category the chips use', () => {
    expect(categoryOf({ kind: 'encounter', method: 'fish-old', part: 1 })).toBe('wild');
    expect(categoryOf({ kind: 'encounter', method: 'surf', part: 1 })).toBe('wild');
    expect(categoryOf({ kind: 'encounter', method: 'prize', part: 1 })).toBe('prize');
    expect(categoryOf({ kind: 'evolution', part: 1 })).toBe('evolution');
    expect(categoryOf({ kind: 'breeding', part: 1 })).toBe('breeding');
    expect(categoryOf({ kind: 'encounter', method: 'headbutt', part: 1 })).toBe('wild');
    expect(categoryOf({ kind: 'encounter', method: 'no-such-method', part: 1 })).toBeUndefined();
  });

  it('labels every unobtainable reason', () => {
    expect(unobtainableLabel('event-only')).toBe('Event distribution only');
  });
});
