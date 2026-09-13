import { parseTemplate } from '../core/wikitext';
import { describeAdapterContract } from './adapter-contract';
import type { WalkContext } from './catch-template-adapter';
import { entry1Adapter } from './entry1';

// Rows copied from the Red/Blue/Yellow fixtures.
describeAdapterContract(entry1Adapter, [
  {
    description: 'grass (Route 1)',
    wikitext: '{{catch/entry1|016|Pidgey|yes|yes|no|Grass|2-5|50%|type1=Normal|type2=Flying}}',
    expected: { dex: 16, games: ['red', 'blue'], method: 'walk-grass', slotCount: 1, requires: [] },
  },
  {
    description: 'cave (Mt. Moon)',
    wikitext: '{{catch/entry1|041|Zubat|no|no|yes|Cave|6-11|75%|type1=Poison|type2=Flying}}',
    locationKind: 'cave',
    expected: { dex: 41, games: ['yellow'], method: 'walk-cave', slotCount: 1 },
  },
  {
    description: 'floor as method (Pokémon Tower)',
    wikitext: '{{catch/entry1|092|Gastly|yes|yes|no|3F|18-24|90%|type1=ghost|type2=poison}}',
    locationKind: 'building',
    expected: { dex: 92, games: ['red', 'blue'], method: 'walk-building', slotCount: 1, subArea: '3F' },
  },
  {
    description: 'surf (Route 12)',
    wikitext: '{{Catch/entry1|079|Slowpoke|no|no|yes|Surf|15|95%|type1=water|type2=psychic}}',
    expected: { dex: 79, games: ['yellow'], method: 'surf', slotCount: 1, requires: ['surf'] },
  },
  {
    description: 'Super Rod (Route 4)',
    wikitext: '{{Catch/entry1|118|Goldeen|no|no|yes|Fish Super|20, 25, 30|90%|type1=Water}}',
    expected: { dex: 118, games: ['yellow'], method: 'fish-super', slotCount: 1, requires: ['super-rod'] },
  },
  {
    description: 'purchase (Route 4)',
    wikitext: '{{Catch/entry1|129|Magikarp|yes|yes|yes|Gift|5|Purchase for {{PDollar}}500|type1=Water}}',
    expected: { dex: 129, games: ['red', 'blue', 'yellow'], method: 'purchase', slotCount: 1 },
  },
  {
    description: 'gift with a tooltip note (Cerulean City)',
    wikitext:
      "{{Catch/entry1|001|Bulbasaur|no|no|yes|Gift|10|{{tt|One|If Pikachu's friendship is 147 or higher.}}|type1=Grass|type2=Poison}}",
    expected: { dex: 1, games: ['yellow'], method: 'gift', slotCount: 1 },
  },
  {
    description: 'fossil revival (Cinnabar Lab)',
    wikitext: '{{Catch/entry1|138|Omanyte|yes|yes|yes|Helix|30|One|type1=Rock|type2=Water}}',
    locationKind: 'building',
    expected: { dex: 138, games: ['red', 'blue', 'yellow'], method: 'fossil', slotCount: 1 },
  },
  {
    description: 'special (Route 1 Pikachu)',
    wikitext: '{{catch/entry1|025|Pikachu|no|no|yes|Special|5|One|type1=Electric}}',
    expected: { dex: 25, games: ['yellow'], method: 'special', slotCount: 1 },
  },
  {
    description: 'in-game trade (Cerulean City)',
    wikitext:
      '{{Catch/entry1|124|Jynx|yes|yes|no|Trade|tradenum=061|tradename=Poliwhirl|The same as the traded Pokémon|One|type1=Ice|type2=Psychic}}',
    expected: { dex: 124, games: ['red', 'blue'], method: 'trade', slotCount: 1 },
  },
]);

describe('entry1 row details', () => {
  const ctx: WalkContext = { pageTitle: 't', locationKind: 'route', subArea: null, divLabel: null };
  const parse = (wikitext: string) => entry1Adapter.parseRow(parseTemplate(wikitext)!, ctx);

  it('parses levels, rates and lowercase types', () => {
    const row = parse('{{Catch/entry1|019|Rattata|yes|yes|no|Grass|8, 10, 12|40%|type1=Normal}}');
    expect(row.name).toBe('Rattata');
    expect(row.types).toEqual(['normal']);
    expect(row.slots[0]).toEqual({
      levels: { min: 8, max: 12, values: [8, 10, 12] },
      rawLevels: '8, 10, 12',
      rate: { kind: 'percent', value: 40 },
    });
  });

  it('accepts the all= rate shorthand (Route 19 Magikarp)', () => {
    const row = parse('{{Catch/entry1|129|Magikarp|yes|yes|yes|Fish Old|5|all=100%|type1=Water}}');
    expect(row.slots[0]?.rate).toEqual({ kind: 'percent', value: 100 });
  });

  it('keeps purchase prices and tooltip notes', () => {
    expect(parse('{{Catch/entry1|129|Magikarp|yes|yes|yes|Gift|5|Purchase for {{PDollar}}500}}').slots[0]?.rate).toEqual({
      kind: 'price',
      value: 500,
    });
    const gift = parse("{{Catch/entry1|001|Bulbasaur|no|no|yes|Gift|10|{{tt|One|If Pikachu's friendship is 147 or higher.}}}}");
    expect(gift.slots[0]?.note).toBe("If Pikachu's friendship is 147 or higher.");
  });

  it('reads the traded species and allows non-numeric trade levels', () => {
    const row = parse(
      '{{Catch/entry1|124|Jynx|yes|yes|no|Trade|tradenum=061|tradename=Poliwhirl|The same as the traded Pokémon|One}}',
    );
    expect(row.trade).toEqual({ giveDex: 61, giveName: 'Poliwhirl' });
    expect(row.slots[0]?.levels).toBeNull();
    expect(row.slots[0]?.rate).toEqual({ kind: 'once' });
  });
});
