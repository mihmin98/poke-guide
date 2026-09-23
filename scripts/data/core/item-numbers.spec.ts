import type { GameLocation, LocationItem } from '../../../src/app/core/domain/models';
import {
  UNNUMBERED,
  assignItemNumbers,
  formatItemNumbers,
  parseItemNumbers,
  type ItemNumberRegistry,
} from './item-numbers';

const item = (itemId: string, where: string, subArea: string | null = null): LocationItem => ({
  no: UNNUMBERED,
  itemId,
  name: itemId,
  quantity: 1,
  games: ['red'],
  obtain: 'pickup',
  subArea,
  where,
});

const location = (id: string, items: LocationItem[]): GameLocation => ({
  id,
  name: id,
  region: 'kanto',
  kind: 'route',
  placement: { red: { part: 1, order: 0 } },
  source: { title: id, revid: 1 },
  notes: [],
  subAreas: [],
  items,
  itemNotes: [],
});

/** The same two locations every rebuild starts from. */
const world = () => [
  location('route-1', [item('potion', 'North'), item('potion', 'South')]),
  location('mt-moon', [item('rare-candy', 'West', '1F'), item('potion', 'East', '1F')]),
];

const numbers = (locations: GameLocation[]) =>
  locations.flatMap((l) => l.items.map((i) => `${l.id}:${i.itemId}:${i.where}=${i.no}`));

function firstBuild(): ItemNumberRegistry {
  return assignItemNumbers(world(), null, [], 'rby').registry;
}

describe('assignItemNumbers', () => {
  it('numbers a new version group from 1 in location and page order', () => {
    const locations = world();
    const result = assignItemNumbers(locations, null, [], 'rby');
    expect(numbers(locations)).toEqual([
      'route-1:potion:North=1',
      'route-1:potion:South=2',
      'mt-moon:rare-candy:West=3',
      'mt-moon:potion:East=4',
    ]);
    expect(result.registry.next).toBe(5);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('keeps every number when the page order changes', () => {
    const locations = world();
    locations[0]!.items.reverse();
    locations.reverse();
    const result = assignItemNumbers(locations, firstBuild(), [], 'rby');
    expect(numbers(locations)).toEqual([
      'mt-moon:rare-candy:West=3',
      'mt-moon:potion:East=4',
      'route-1:potion:South=2',
      'route-1:potion:North=1',
    ]);
    expect([result.errors, result.warnings, result.notes]).toEqual([[], [], []]);
  });

  it('gives an inserted item a new number without shifting its neighbours', () => {
    const locations = world();
    locations[0]!.items.unshift(item('potion', 'Behind the tree'));
    const result = assignItemNumbers(locations, firstBuild(), [], 'rby');
    expect(numbers(locations).slice(0, 3)).toEqual([
      'route-1:potion:Behind the tree=5',
      'route-1:potion:North=1',
      'route-1:potion:South=2',
    ]);
    expect(result.registry.next).toBe(6);
    expect(result.notes).toEqual(['1 new item number(s), up to #5']);
  });

  it('keeps the number of a reworded item and warns about it', () => {
    const locations = world();
    locations[0]!.items[1]!.where = 'South, by the ledge';
    const result = assignItemNumbers(locations, firstBuild(), [], 'rby');
    expect(locations[0]!.items[1]!.no).toBe(2);
    expect(result.warnings).toEqual([
      'Item #2 potion in route-1 kept its number, but its text changed from "South" to "South, by the ledge". ' +
        "Check that it's still the same spot.",
    ]);
    expect(result.registry.items.find((e) => e.no === 2)?.where).toBe('South, by the ledge');
  });

  it('fails when an item disappears, until its number is retired', () => {
    const gone = () => {
      const locations = world();
      locations[1]!.items.shift();
      return locations;
    };
    const failing = assignItemNumbers(gone(), firstBuild(), [], 'rby');
    expect(failing.errors).toEqual([
      'Item #3 rare-candy in mt-moon (1F) ("West") is no longer in the data. If it\'s really gone, add it to ' +
        'retiredItems in overrides/items.ts with a reason; its number is never reused.',
    ]);

    const retired = [{ no: 3, reason: 'Removed from the page' }];
    const passing = assignItemNumbers(gone(), firstBuild(), retired, 'rby');
    expect(passing.errors).toEqual([]);
    expect(passing.notes).toEqual(['Retired item #3 rare-candy in mt-moon (1F)']);
    expect(passing.registry.items.map((e) => e.no)).toEqual([1, 2, 4]);

    // A later item never gets the retired number back.
    const readded = gone();
    readded[1]!.items.push(item('rare-candy', 'Somewhere else', '1F'));
    const later = assignItemNumbers(readded, passing.registry, retired, 'rby');
    expect(readded[1]!.items.at(-1)!.no).toBe(5);
    expect(later.errors).toEqual([]);
  });

  it('rejects a retired number that is still in the data or was never handed out', () => {
    const result = assignItemNumbers(
      world(),
      firstBuild(),
      [
        { no: 1, reason: 'x' },
        { no: 99, reason: 'y' },
      ],
      'rby',
    );
    expect(result.errors).toEqual([
      'Item #1 potion in route-1 is retired but still in the data',
      'Retired item number 99 was never handed out',
    ]);
  });

  it('rejects a registry for another version group or with duplicate numbers', () => {
    const registry = firstBuild();
    registry.items[1]!.no = 1;
    const result = assignItemNumbers(world(), { ...registry, versionGroupId: 'gsc' }, [], 'rby');
    expect(result.errors.slice(0, 2)).toEqual([
      'Item number registry is for "gsc", not "rby"',
      'Item number registry has an invalid or duplicate number 1',
    ]);
  });
});

describe('formatItemNumbers / parseItemNumbers', () => {
  it('round-trips with one entry per line', () => {
    const registry = firstBuild();
    const text = formatItemNumbers(registry);
    expect(text.split('\n')[4]).toBe(
      '    {"no":1,"locationId":"route-1","subArea":null,"itemId":"potion","where":"North"},',
    );
    expect(parseItemNumbers(text)).toEqual(registry);
  });

  it('refuses a malformed file', () => {
    expect(() =>
      parseItemNumbers('{"versionGroupId":"rby","next":1,"items":[{"no":"1"}]}'),
    ).toThrow('malformed');
  });
});
