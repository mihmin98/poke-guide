import { POKEMON_TYPES } from '../../../src/app/core/games/pokemon-types';
import { fixture } from '../testing/fixtures';
import { parseNationalDexList, speciesInRange } from './species-list';
import { TYPE_HISTORY, typeExistsIn, typesInGeneration } from './type-history';

describe('typesInGeneration', () => {
  it('applies Gen I types', () => {
    expect(typesInGeneration(35, ['fairy'], 1)).toEqual(['normal']);
    expect(typesInGeneration(39, ['normal', 'fairy'], 1)).toEqual(['normal']);
    expect(typesInGeneration(122, ['psychic', 'fairy'], 1)).toEqual(['psychic']);
    expect(typesInGeneration(81, ['electric', 'steel'], 1)).toEqual(['electric']);
  });

  it('switches at the right generation', () => {
    expect(typesInGeneration(81, ['electric', 'steel'], 2)).toEqual(['electric', 'steel']);
    expect(typesInGeneration(35, ['fairy'], 5)).toEqual(['normal']);
    expect(typesInGeneration(35, ['fairy'], 6)).toEqual(['fairy']);
    expect(typesInGeneration(1, ['grass', 'poison'], 1)).toEqual(['grass', 'poison']);
  });

  it('applies the Gen II–V types of Gen II species', () => {
    expect(typesInGeneration(175, ['fairy'], 2)).toEqual(['normal']);
    expect(typesInGeneration(176, ['fairy', 'flying'], 2)).toEqual(['normal', 'flying']);
    expect(typesInGeneration(184, ['water', 'fairy'], 2)).toEqual(['water']);
    expect(typesInGeneration(210, ['fairy'], 6)).toEqual(['fairy']);
  });

  it('leaves every Gen I and II species with types that exist in Gen II', () => {
    const species = speciesInRange(
      parseNationalDexList(fixture('rby', 'national-dex-list').wikitext),
      [1, 251],
    );
    expect(species).toHaveLength(251);
    const invalid = species.filter(
      (s) => !typesInGeneration(s.dex, s.types, 2).every((t) => typeExistsIn(t, 2)),
    );
    expect(invalid.map((s) => s.name)).toEqual([]);
  });

  it('counts the types of each generation', () => {
    const count = (gen: number) => POKEMON_TYPES.filter((t) => typeExistsIn(t.id, gen)).length;
    expect([count(1), count(2), count(5), count(6)]).toEqual([15, 18, 17, 18]);
    // Gen II–IV's extra one is the move-only ??? type.
    expect(typeExistsIn('unknown', 2)).toBe(true);
    expect(typeExistsIn('unknown', 5)).toBe(false);
  });

  it('has no duplicate entries', () => {
    const keys = TYPE_HISTORY.map((e) => `${e.dex}@${e.untilGeneration}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('leaves every Gen I species with types that exist in Gen I', () => {
    const species = speciesInRange(
      parseNationalDexList(fixture('rby', 'national-dex-list').wikitext),
      [1, 151],
    );
    const invalid = species.filter(
      (s) => !typesInGeneration(s.dex, s.types, 1).every((t) => typeExistsIn(t, 1)),
    );
    expect(invalid.map((s) => s.name)).toEqual([]);
  });
});
