import { findNestedSection, headingsWithin } from './sections';
import { parseHeadings } from './wikitext';

const standard = `Intro
==Items==
x
==Pokémon==
===Generation I===
GEN1
====1F====
FLOOR
===Generation II===
GEN2
==Trainers==
T`;

const silph = `==Layout==
===Items===
===Pokémon===
====Generation I====
SILPH
====Generation II====
===Trainers===`;

describe('findNestedSection', () => {
  it('finds a generation section under Pokémon, including deeper sub-area headings', () => {
    const section = findNestedSection(standard, ['Pokémon', 'Generation I']);
    expect(section).not.toBeNull();
    const body = standard.slice(section!.start, section!.end);
    expect(body).toContain('GEN1');
    expect(body).toContain('====1F====');
    expect(body).not.toContain('GEN2');
  });

  it('ends a section at the next heading of the same or higher level', () => {
    const section = findNestedSection(standard, ['Pokémon', 'Generation II'])!;
    expect(standard.slice(section.start, section.end).trim()).toBe('GEN2');
  });

  it('works with deeper heading levels (Silph Co.)', () => {
    const section = findNestedSection(silph, ['pokémon', 'generation i'])!;
    expect(section.heading.level).toBe(4);
    expect(silph.slice(section.start, section.end).trim()).toBe('SILPH');
  });

  it('matches regular expressions and markup in titles', () => {
    const text = "==[[Pokémon]]==\n==='''Generation I'''===\nX\n";
    expect(findNestedSection(text, [/^Pok[eé]mon$/, 'Generation I'])).not.toBeNull();
  });

  it('requires nesting and returns null when absent', () => {
    expect(findNestedSection(standard, ['Trainers', 'Generation I'])).toBeNull();
    expect(findNestedSection(standard, ['Generation III'])).toBeNull();
  });

  it('lists headings inside a section', () => {
    const headings = parseHeadings(standard);
    const section = findNestedSection(standard, ['Pokémon', 'Generation I'], headings)!;
    expect(headingsWithin(headings, section).map((h) => h.title)).toEqual(['1F']);
  });
});
