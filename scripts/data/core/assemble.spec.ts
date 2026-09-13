import { rbyConfig } from '../version-groups/rby/config';
import type { LocationConfig, VersionGroupConfig } from '../version-groups/types';
import { diffLocationCategory, placeLocations } from './assemble';

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
