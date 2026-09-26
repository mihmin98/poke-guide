import { rbyConfig } from '../version-groups/rby/config';
import type { LocationConfig, VersionGroupConfig } from '../version-groups/types';
import type { GameLocation, LocationItem } from '../../../src/app/core/domain/models';
import {
  addLocationRequirements,
  diffLocationCategory,
  placeLocations,
  splitItemNotes,
} from './assemble';

const location = (id: string, placement: LocationConfig['placement']): LocationConfig => ({
  id,
  page: id,
  name: id,
  kind: 'route',
  region: 'kanto',
  placement,
});

describe('placeLocations', () => {
  it('orders by part × 100 + index within the part, counted per game', () => {
    const placements = placeLocations(
      [
        location('a', { red: { part: 1 }, yellow: { part: 1 } }),
        location('b', { yellow: { part: 1 } }),
        location('c', { red: { part: 1 }, yellow: { part: 2 } }),
      ],
      ['red', 'yellow'],
    );
    expect(Object.fromEntries(placements)).toEqual({
      a: { red: { part: 1, order: 100 }, yellow: { part: 1, order: 100 } },
      b: { yellow: { part: 1, order: 101 } },
      c: { red: { part: 1, order: 101 }, yellow: { part: 2, order: 200 } },
    });
  });

  it('gives every rby location a distinct order per game', () => {
    const placements = [...placeLocations(rbyConfig.locations, rbyConfig.games).values()];
    for (const game of rbyConfig.games) {
      const orders = placements.map((p) => p[game]!.order);
      expect(new Set(orders).size).toBe(orders.length);
      expect(orders).toEqual([...orders].sort((x, y) => x - y));
    }
  });
});

describe('diffLocationCategory', () => {
  const config = {
    locationCategory: 'Category:Test',
    locations: [location('Route 1', {}), location('Route 2', {})],
    ignoredCategoryPages: ['Kanto', 'Old page'],
  } as unknown as VersionGroupConfig;

  it('warns about unconfigured members and stale configured or ignored pages', () => {
    expect(
      diffLocationCategory(['Route 1', 'Kanto', 'Route 3'], config).map((i) => i.message),
    ).toEqual([
      '"Route 3" is in Category:Test but not in the location config',
      'Location "Route 2" is not in Category:Test',
      'Ignored page "Old page" is no longer in Category:Test',
    ]);
  });

  it('is silent when the category matches', () => {
    expect(diffLocationCategory(['Route 1', 'Route 2', 'Kanto', 'Old page'], config)).toEqual([]);
  });
});

describe('addLocationRequirements', () => {
  it("adds a location's entry requirements to its items, once", () => {
    const item = (name: string, requires?: string[][]): LocationItem => ({
      no: 0,
      itemId: name,
      name,
      quantity: 1,
      games: ['gold'],
      obtain: 'pickup',
      subArea: null,
      where: '',
      ...(requires ? { requires } : {}),
    });
    const locations = [
      { id: 'whirl-islands', items: [item('a'), item('b', [['surf'], ['strength']])] },
      { id: 'route-41', items: [item('c')] },
    ] as GameLocation[];
    addLocationRequirements(locations, [
      { id: 'whirl-islands', requires: ['surf', 'whirlpool'] },
      { id: 'route-41' },
    ]);
    expect(locations.flatMap((l) => l.items.map((i) => i.requires))).toEqual([
      [['surf'], ['whirlpool']],
      [['whirlpool'], ['surf'], ['strength']],
      undefined,
    ]);
  });
});

describe('splitItemNotes', () => {
  it('turns matching rows into notes, naming the games of a note that not every game has', () => {
    const item = (name: string, where: string, games: LocationItem['games']): LocationItem => ({
      no: 0,
      itemId: name,
      name,
      quantity: 1,
      games,
      obtain: 'pickup',
      subArea: null,
      where,
    });
    const config = {
      games: ['gold', 'silver', 'crystal'] as const,
      itemNoteRules: [
        { match: /\(daily\)/, note: (i: LocationItem) => `Daily tree: ${i.name}` },
        { match: /^Sometimes/, note: (i: LocationItem) => `Phone gift: ${i.name}` },
      ],
    };
    const result = splitItemNotes(
      [
        item('Berry', 'On the tree (daily)', ['gold', 'silver']),
        item('Berry', 'On the tree (daily)', ['crystal']),
        item('Potion', 'On the ground', ['gold', 'silver', 'crystal']),
        item('Nugget', 'Sometimes given out', ['crystal']),
      ],
      ['Fake item balls: Voltorb ×6'],
      { ...config, games: [...config.games] },
    );
    expect(result.items.map((i) => i.name)).toEqual(['Potion']);
    expect(result.itemNotes).toEqual([
      'Fake item balls: Voltorb ×6',
      'Daily tree: Berry',
      { text: 'Phone gift: Nugget', games: ['crystal'] },
    ]);
  });
});
