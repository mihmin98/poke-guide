import { checkCommittedGroup, loadCommittedGroup, type CommittedGroup } from './committed-data';

// Loaded once: the committed files are large, and every test works on its own copy.
const committed = loadCommittedGroup('rby');
const copy = (): CommittedGroup => structuredClone(committed);
const errors = (group: CommittedGroup) =>
  checkCommittedGroup(group)
    .filter((i) => i.level === 'error')
    .map((i) => i.message);

const firstItemLocation = (group: CommittedGroup) => {
  const location = group.data.locations.find((l) => l.items.length > 0);
  if (!location) throw new Error('No location with items');
  return location;
};

describe('checkCommittedGroup', () => {
  it('passes the committed rby files', () => {
    expect(errors(copy())).toEqual([]);
  });

  it('reports a schema error in the data file', () => {
    const group = copy();
    (group.data as { versionGroupId: unknown }).versionGroupId = 42;
    expect(errors(group).some((m) => m.startsWith('Data schema:'))).toBe(true);
  });

  it('reports an item whose number belongs to another registry entry', () => {
    const group = copy();
    const [first, second] = group.registry.items;
    const item = firstItemLocation(group).items[0]!;
    item.no = item.no === first!.no ? second!.no : first!.no;
    expect(errors(group).some((m) => /in the data but .* in the item registry/.test(m))).toBe(true);
  });

  it('reports an item missing from the registry', () => {
    const group = copy();
    const no = firstItemLocation(group).items[0]!.no;
    group.registry.items = group.registry.items.filter((e) => e.no !== no);
    expect(errors(group)).toContainEqual(
      expect.stringMatching(new RegExp(`^Item #${no} .* is not in the item registry`)),
    );
  });

  it('reports a registry entry missing from the data', () => {
    const group = copy();
    const removed = firstItemLocation(group).items.shift()!;
    expect(errors(group)).toContainEqual(
      expect.stringMatching(new RegExp(`^Registry item #${removed.no} .* missing from the data`)),
    );
  });

  it('reports a number at or above the registry next number', () => {
    const group = copy();
    group.registry.next = 1;
    expect(errors(group).some((m) => m.includes("not below the registry's next number"))).toBe(
      true,
    );
  });
});
