import { parseLevels, unionLevels } from './levels';
import { parseRate } from './rate';

describe('parseLevels', () => {
  it.each([
    ['5', { min: 5, max: 5 }],
    ['2-5', { min: 2, max: 5 }],
    ['2 – 5', { min: 2, max: 5 }],
    ['8, 10, 12', { min: 8, max: 12, values: [8, 10, 12] }],
    ['27, 32', { min: 27, max: 32, values: [27, 32] }],
    ['2-3, 6', { min: 2, max: 6, values: [2, 3, 6] }],
    ['3, 4-5', { min: 3, max: 5 }],
  ])('parses %s', (raw, expected) => {
    expect(parseLevels(raw)).toEqual(expected);
  });

  it.each(['', 'One', '5-2', '5,', 'Lv. 5'])('rejects %j', (raw) => {
    expect(parseLevels(raw)).toBeNull();
  });
});

describe('unionLevels', () => {
  it('merges ranges and keeps gaps as values', () => {
    expect(unionLevels({ min: 2, max: 4 }, { min: 5, max: 7 })).toEqual({ min: 2, max: 7 });
    expect(unionLevels({ min: 2, max: 3 }, { min: 6, max: 6 })).toEqual({ min: 2, max: 6, values: [2, 3, 6] });
    expect(unionLevels(null, { min: 1, max: 1 })).toEqual({ min: 1, max: 1 });
  });
});

describe('parseRate', () => {
  it('parses percentages', () => {
    expect(parseRate('50%')).toEqual({ rate: { kind: 'percent', value: 50 } });
    expect(parseRate('12.5%')).toEqual({ rate: { kind: 'percent', value: 12.5 } });
  });

  it('parses one-time encounters', () => {
    expect(parseRate('One')).toEqual({ rate: { kind: 'once' } });
  });

  it('parses purchases', () => {
    expect(parseRate('Purchase for {{PDollar}}500')).toEqual({ rate: { kind: 'price', value: 500 } });
    expect(parseRate('Purchase for {{PDollar}}1,000')).toEqual({ rate: { kind: 'price', value: 1000 } });
  });

  it('keeps tooltip text as a note', () => {
    expect(parseRate("{{tt|One|If Pikachu's friendship is 147 or higher.}}")).toEqual({
      rate: { kind: 'once' },
      note: "If Pikachu's friendship is 147 or higher.",
    });
  });

  it('falls back to unknown', () => {
    expect(parseRate('Two')).toEqual({ rate: { kind: 'unknown', text: 'Two' } });
  });
});
