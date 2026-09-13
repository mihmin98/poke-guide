/**
 * Section finder. Heading depth varies between pages (`==Pokémon==` / `===Generation I===` on most,
 * `===Pokémon===` / `====Generation I====` on Silph Co.), so levels are only compared relative to each other.
 */
import { stripMarkup } from './markup';
import { parseHeadings, type Heading } from './wikitext';

export interface SectionRange {
  heading: Heading;
  /** Offset where the content starts (after the heading line). */
  start: number;
  /** Offset of the next heading at the same or a higher level, or the end of the text. */
  end: number;
}

/** A heading title to match: a string compares case-insensitively after stripping markup. */
export type TitleMatcher = string | RegExp;

export function headingText(heading: Heading): string {
  return stripMarkup(heading.title);
}

function matchesTitle(heading: Heading, matcher: TitleMatcher): boolean {
  const title = headingText(heading);
  return typeof matcher === 'string' ? title.toLowerCase() === matcher.toLowerCase() : matcher.test(title);
}

export function sectionAt(text: string, headings: readonly Heading[], index: number): SectionRange {
  const heading = headings[index]!;
  let end = text.length;
  for (let j = index + 1; j < headings.length; j++) {
    if (headings[j]!.level <= heading.level) {
      end = headings[j]!.start;
      break;
    }
  }
  return { heading, start: Math.min(heading.end + 1, text.length), end };
}

/**
 * Finds a section by a path of heading titles, each nested (deeper) inside the previous one.
 * Tries every candidate at each step, so a page with two `Pokémon` headings still resolves.
 */
export function findNestedSection(
  text: string,
  path: readonly TitleMatcher[],
  headings: readonly Heading[] = parseHeadings(text),
): SectionRange | null {
  if (path.length === 0) return null;
  const search = (from: number, to: number, parentLevel: number, depth: number): SectionRange | null => {
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i]!;
      if (heading.start < from || heading.start >= to || heading.level <= parentLevel) continue;
      if (!matchesTitle(heading, path[depth]!)) continue;
      const section = sectionAt(text, headings, i);
      if (depth === path.length - 1) return section;
      const found = search(section.start, section.end, heading.level, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return search(0, text.length, 1, 0);
}

/** Headings strictly inside a section's content range. */
export function headingsWithin(headings: readonly Heading[], section: SectionRange): Heading[] {
  return headings.filter((h) => h.start >= section.start && h.start < section.end);
}
