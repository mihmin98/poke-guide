/**
 * Regional Pokédex numbers from a `List of Pokémon by … Pokédex number` page (plan §16 Phase 10), for the
 * checklist's "Regional" sort. Rows are `{{rdex|<regional>|<national>|<name>|…}}`; a species with many forms
 * (Unown in the New Pokédex) is a hand-written table row `| … | #061` followed by `| … | #0201`.
 */
import { findTemplates, stripComments } from './wikitext';

/** National Dex number → regional number. */
export function parseRegionalDexList(wikitext: string): Map<number, number> {
  const text = stripComments(wikitext);
  const numbers = new Map<number, number>();
  const add = (regional: number, national: number) => {
    if (!numbers.has(national)) numbers.set(national, regional);
  };
  for (const call of findTemplates(text)) {
    if (call.name !== 'rdex') continue;
    const regional = Number(call.positional[0]);
    const national = Number(call.positional[1]);
    if (!Number.isInteger(regional) || !Number.isInteger(national) || regional < 1 || national < 1) {
      throw new Error(`Malformed rdex row: ${text.slice(call.start, call.end)}`);
    }
    add(regional, national);
  }
  for (const match of text.matchAll(/^\|[^|\n]*\|\s*#(\d{3})\s*\n\|[^|\n]*\|\s*#(\d{3,4})\s*$/gm)) {
    add(Number(match[1]), Number(match[2]));
  }
  return numbers;
}
