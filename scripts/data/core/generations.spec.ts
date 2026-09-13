import { fromRoman, parseGenerationRange, toRoman } from './generations';

describe('roman numerals', () => {
  it('round-trips generations 1–12', () => {
    for (let gen = 1; gen <= 12; gen++) expect(fromRoman(toRoman(gen))).toBe(gen);
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
  });

  it('rejects malformed numerals', () => {
    expect(fromRoman('IIII')).toBeNull();
    expect(fromRoman('VX')).toBeNull();
    expect(fromRoman('Gen')).toBeNull();
  });
});

describe('parseGenerationRange', () => {
  it.each([
    ['Generations I-V', { from: 1, to: 5 }],
    ['Generations I–V', { from: 1, to: 5 }],
    ['Generation VI onward', { from: 6, to: Infinity }],
    ['Generation VI onwards', { from: 6, to: Infinity }],
    ['Generations I to V', { from: 1, to: 5 }],
    ['Generation I to V', { from: 1, to: 5 }],
    ['Generation I', { from: 1, to: 1 }],
    ['Generation II only', { from: 2, to: 2 }],
  ])('%s', (text, expected) => {
    expect(parseGenerationRange(text)).toEqual(expected);
  });

  it('returns null for other headings', () => {
    expect(parseGenerationRange('Partner Pikachu')).toBeNull();
    expect(parseGenerationRange('Generations V-I')).toBeNull();
  });
});
