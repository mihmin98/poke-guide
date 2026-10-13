import {
  assignMilestoneNumbers,
  formatMilestoneNumbers,
  parseMilestoneNumbers,
  type MilestoneDefinition,
  type MilestoneNumberRegistry,
} from './milestone-numbers';

const definition = (id: string): MilestoneDefinition => ({
  id,
  label: id,
  kind: 'event',
  part: { red: 1 },
  locationId: 'pallet-town',
});
const list = (...ids: string[]) => ids.map(definition);
const numbers = (result: ReturnType<typeof assignMilestoneNumbers>) =>
  result.milestones.map((m) => [m.id, m.no]);

describe('assignMilestoneNumbers', () => {
  it('numbers a new version group from 1 in list order', () => {
    const result = assignMilestoneNumbers(list('a', 'b', 'c'), null, [], 'rby');
    expect(numbers(result)).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    expect(result.registry).toEqual({
      versionGroupId: 'rby',
      next: 4,
      milestones: [
        { no: 1, id: 'a' },
        { no: 2, id: 'b' },
        { no: 3, id: 'c' },
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('keeps numbers by id when the list is reordered, and appends new ids', () => {
    const first = assignMilestoneNumbers(list('a', 'b'), null, [], 'rby');
    const second = assignMilestoneNumbers(list('new', 'b', 'a'), first.registry, [], 'rby');
    expect(numbers(second)).toEqual([
      ['new', 3],
      ['b', 2],
      ['a', 1],
    ]);
    expect(second.registry.next).toBe(4);
    expect(second.notes).toEqual(['1 new milestone number(s), up to #3']);
  });

  it('fails when a registered id disappears, until its number is retired', () => {
    const first = assignMilestoneNumbers(list('a', 'b'), null, [], 'rby');
    const gone = assignMilestoneNumbers(list('b'), first.registry, [], 'rby');
    expect(gone.errors).toEqual([
      expect.stringMatching(/^Milestone #1 "a" is no longer in the list/),
    ]);

    const retired = assignMilestoneNumbers(
      list('b', 'a2'),
      first.registry,
      [{ no: 1, reason: 'renamed to a2' }],
      'rby',
    );
    expect(retired.errors).toEqual([]);
    expect(numbers(retired)).toEqual([
      ['b', 2],
      ['a2', 3],
    ]);
    expect(retired.registry.milestones).toEqual([
      { no: 2, id: 'b' },
      { no: 3, id: 'a2' },
    ]);
    expect(retired.notes).toContain('Retired milestone #1 "a"');
  });

  it('never reuses a retired number', () => {
    const first = assignMilestoneNumbers(list('a', 'b'), null, [], 'rby');
    const second = assignMilestoneNumbers(
      list('a'),
      first.registry,
      [{ no: 2, reason: 'x' }],
      'rby',
    );
    const third = assignMilestoneNumbers(
      list('a', 'c'),
      second.registry,
      [{ no: 2, reason: 'x' }],
      'rby',
    );
    expect(numbers(third)).toEqual([
      ['a', 1],
      ['c', 3],
    ]);
  });

  it('reports duplicate ids, retired ids still listed, and bad registries', () => {
    const first = assignMilestoneNumbers(list('a', 'b'), null, [], 'rby');
    const broken: MilestoneNumberRegistry = {
      versionGroupId: 'gsc',
      next: 2,
      milestones: [...first.registry.milestones, { no: 1, id: 'c' }],
    };
    const result = assignMilestoneNumbers(
      list('a', 'a', 'b'),
      broken,
      [
        { no: 1, reason: 'gone' },
        { no: 9, reason: 'never' },
      ],
      'rby',
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Milestone number registry is for "gsc", not "rby"',
        'Milestone number registry has an invalid or duplicate number 2',
        'Milestone number registry has an invalid or duplicate number 1',
        'Milestone id "a" is used twice',
        'Milestone #1 "a" is retired but still in the list',
        'Retired milestone number 9 was never handed out',
      ]),
    );
  });
});

describe('formatMilestoneNumbers / parseMilestoneNumbers', () => {
  it('round-trips a registry, one entry per line', () => {
    const { registry } = assignMilestoneNumbers(list('a', 'b'), null, [], 'rby');
    const text = formatMilestoneNumbers(registry);
    expect(text).toBe(
      '{\n  "versionGroupId": "rby",\n  "next": 3,\n  "milestones": [\n' +
        '    {"no":1,"id":"a"},\n    {"no":2,"id":"b"}\n  ]\n}\n',
    );
    expect(parseMilestoneNumbers(text)).toEqual(registry);
  });

  it('rejects a malformed registry', () => {
    expect(() => parseMilestoneNumbers('{"versionGroupId":"rby","next":1}')).toThrow(
      'The milestone number registry is malformed',
    );
    expect(() =>
      parseMilestoneNumbers('{"versionGroupId":"rby","next":2,"milestones":[{"no":"1","id":"a"}]}'),
    ).toThrow();
  });
});
