import {
  findTemplates,
  normalizeTemplateName,
  parseHeadings,
  parseTemplate,
  splitTopLevel,
  stripComments,
} from './wikitext';

describe('stripComments', () => {
  it('removes comments, including multi-line and unterminated ones', () => {
    expect(stripComments('a<!-- x -->b<!--\ny\n-->c')).toBe('abc');
    expect(stripComments('a<!-- never closed')).toBe('a');
  });

  it('removes refs', () => {
    expect(stripComments('a<ref name="x">note {{p|Mew}}</ref>b<ref name="y" />c')).toBe('abc');
  });
});

describe('parseHeadings', () => {
  it('reads levels and titles with offsets', () => {
    const text = '==Pokémon==\n===Generation I===\nbody\n==== 1F ====\n';
    const headings = parseHeadings(text);
    expect(headings.map((h) => [h.level, h.title])).toEqual([
      [2, 'Pokémon'],
      [3, 'Generation I'],
      [4, '1F'],
    ]);
    expect(text.slice(headings[1]!.start, headings[1]!.end)).toBe('===Generation I===');
  });

  it('ignores inline equals signs and level-1 markers', () => {
    expect(parseHeadings('text == not a heading ==\n= level one =')).toEqual([]);
  });

  it('treats extra closing markers as part of the title, like MediaWiki', () => {
    expect(parseHeadings('==Uneven===').map((h) => [h.level, h.title])).toEqual([[2, 'Uneven=']]);
  });
});

describe('splitTopLevel', () => {
  it('does not split inside nested templates or links', () => {
    expect(splitTopLevel('a|{{tt|b|c}}|[[x|y]]|d')).toEqual(['a', '{{tt|b|c}}', '[[x|y]]', 'd']);
  });
});

describe('normalizeTemplateName', () => {
  it('lowercases, normalizes underscores and drops the namespace', () => {
    expect(normalizeTemplateName(' Catch/entry1 ')).toBe('catch/entry1');
    expect(normalizeTemplateName('Template:Catch_div')).toBe('catch div');
  });
});

describe('findTemplates', () => {
  it('parses positional and named parameters', () => {
    const [call] = findTemplates(
      '{{catch/entry1|016|Pidgey|yes|yes|no|Grass|2-5|50%|type1=Normal|type2=Flying}}',
    );
    expect(call?.name).toBe('catch/entry1');
    expect(call?.positional).toEqual(['016', 'Pidgey', 'yes', 'yes', 'no', 'Grass', '2-5', '50%']);
    expect(call?.named).toEqual({ type1: 'Normal', type2: 'Flying' });
  });

  it('keeps nested templates inside parameters', () => {
    const [call] = findTemplates(
      "{{Catch/entry1|025|Pikachu|no|no|yes|Gift|5|{{tt|One|If Pikachu's friendship is 147.}}}}",
    );
    expect(call?.positional[7]).toBe("{{tt|One|If Pikachu's friendship is 147.}}");
  });

  it('finds several templates on one line, in order, with offsets', () => {
    const text =
      'x{{catch/div|sea|Surfing}}{{catch/entry1|072|Tentacool|yes|yes|yes|Surf|5-40|100%}}y';
    const calls = findTemplates(text);
    expect(calls.map((c) => c.name)).toEqual(['catch/div', 'catch/entry1']);
    expect(text.slice(calls[0]!.start, calls[0]!.end)).toBe('{{catch/div|sea|Surfing}}');
    expect(calls[1]!.end).toBe(text.length - 1);
  });

  it('treats "=" inside nested markup or HTML as positional', () => {
    const [call] = findTemplates('{{t|{{a|b=c}}|<span style="color:red">x</span>|k = v}}');
    expect(call?.positional).toEqual(['{{a|b=c}}', '<span style="color:red">x</span>']);
    expect(call?.named).toEqual({ k: 'v' });
  });

  it('respects the scan range and skips an unbalanced opener', () => {
    const text = '{{a}} {{broken {{b}}';
    expect(findTemplates(text).map((c) => c.name)).toEqual(['a', 'b']);
    expect(findTemplates(text, 5).map((c) => c.name)).toEqual(['b']);
  });
});

describe('parseTemplate', () => {
  it('parses exactly one template', () => {
    expect(parseTemplate(' {{p|Mew}} ')?.positional).toEqual(['Mew']);
    expect(parseTemplate('{{p|Mew}} tail')).toBeNull();
    expect(parseTemplate('plain')).toBeNull();
  });
});
