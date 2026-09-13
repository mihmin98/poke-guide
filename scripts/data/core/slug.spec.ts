import { slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Nidoran♀', 'nidoran-f'],
    ['Nidoran♂', 'nidoran-m'],
    ["Farfetch'd", 'farfetchd'],
    ['Mr. Mime', 'mr-mime'],
    ['Pokémon Mansion (Kanto)', 'pokemon-mansion-kanto'],
    ['Area 1 - East', 'area-1-east'],
    ['B1F', 'b1f'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
