import { fixture } from '../testing/fixtures';
import { parseNationalDexList, speciesInRange } from './species-list';

describe('parseNationalDexList', () => {
  const entries = parseNationalDexList(fixture('rby', 'national-dex-list').wikitext);

  it('parses every species in order, skipping regional forms', () => {
    expect(entries.length).toBeGreaterThanOrEqual(1025);
    expect(entries.map((e) => e.dex)).toEqual(entries.map((_, i) => i + 1));
  });

  it('reads names, slugs and current types', () => {
    const byDex = new Map(entries.map((e) => [e.dex, e]));
    expect(byDex.get(1)).toEqual({
      dex: 1,
      name: 'Bulbasaur',
      slug: 'bulbasaur',
      types: ['grass', 'poison'],
    });
    expect(byDex.get(19)).toEqual({ dex: 19, name: 'Rattata', slug: 'rattata', types: ['normal'] });
    expect(byDex.get(29)?.slug).toBe('nidoran-f');
    expect(byDex.get(32)?.slug).toBe('nidoran-m');
    expect(byDex.get(83)?.slug).toBe('farfetchd');
    expect(byDex.get(122)).toMatchObject({ slug: 'mr-mime', types: ['psychic', 'fairy'] });
    expect(byDex.get(151)?.name).toBe('Mew');
  });

  it('selects a range', () => {
    const gen1 = speciesInRange(entries, [1, 151]);
    expect(gen1).toHaveLength(151);
    expect(() => speciesInRange(entries.slice(0, 100), [1, 151])).toThrow(/covers 100/);
  });

  it('skips announced species without a number', () => {
    expect(
      parseNationalDexList('{{ndex|0001|Bulbasaur|Grass}}\n{{ndex|????|Browt|Grass}}'),
    ).toHaveLength(1);
  });

  it('fails on unknown types and gaps', () => {
    expect(() => parseNationalDexList('{{ndex|0001|Bulbasaur|Grass|Shadow}}')).toThrow(
      /Unknown type/,
    );
    expect(() =>
      parseNationalDexList('{{ndex|0001|Bulbasaur|Grass}}\n{{ndex|0003|Venusaur|Grass}}'),
    ).toThrow(/not contiguous/);
  });
});
