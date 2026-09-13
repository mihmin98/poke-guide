/**
 * Species master list from `List of Pokémon by National Pokédex number` (plan §7.5):
 * `{{ndex|0001|Bulbasaur|Grass|Poison}}`. Regional forms (`{{ndex/form|…}}`) are skipped.
 * The types are the CURRENT ones; apply `type-history.ts` for older generations.
 */
import { POKEMON_TYPES, type PokemonType } from '../../../src/app/core/games/pokemon-types';
import { stripMarkup } from './markup';
import { slugify } from './slug';
import { findTemplates, stripComments } from './wikitext';

export const NATIONAL_DEX_LIST_PAGE = 'List of Pokémon by National Pokédex number';

export interface SpeciesListEntry {
  dex: number;
  name: string;
  slug: string;
  types: PokemonType[];
}

const TYPE_IDS = new Set<string>(POKEMON_TYPES.map((t) => t.id));

export function toPokemonType(raw: string): PokemonType {
  const id = stripMarkup(raw).toLowerCase();
  if (!TYPE_IDS.has(id)) throw new Error(`Unknown type "${raw}"`);
  return id as PokemonType;
}

export function parseNationalDexList(wikitext: string): SpeciesListEntry[] {
  const entries: SpeciesListEntry[] = [];
  const text = stripComments(wikitext);
  for (const call of findTemplates(text)) {
    if (call.name !== 'ndex') continue;
    const [rawDex = '', rawName = '', ...rawTypes] = call.positional;
    // Announced species without a number yet: `{{ndex|????|Browt|Grass}}`.
    if (/^\?+$/.test(rawDex)) continue;
    const dex = Number(rawDex);
    const name = stripMarkup(rawName);
    if (!Number.isInteger(dex) || dex < 1 || !name) {
      throw new Error(`Malformed ndex row: ${text.slice(call.start, call.end)}`);
    }
    const types = rawTypes.filter((t) => t.trim() !== '').map(toPokemonType);
    if (types.length < 1 || types.length > 2) throw new Error(`#${dex} ${name} has ${types.length} types`);
    const previous = entries.at(-1);
    if (previous && dex !== previous.dex + 1) {
      throw new Error(`National Dex list is not contiguous: #${previous.dex} is followed by #${dex}`);
    }
    entries.push({ dex, name, slug: slugify(name), types });
  }
  if (entries[0]?.dex !== 1) throw new Error('National Dex list does not start at #1');
  const slugs = new Set(entries.map((e) => e.slug));
  if (slugs.size !== entries.length) throw new Error('Species slugs are not unique');
  return entries;
}

/** Entries with `from <= dex <= to`; throws if the list doesn't cover the range. */
export function speciesInRange(entries: readonly SpeciesListEntry[], [from, to]: [number, number]): SpeciesListEntry[] {
  const selected = entries.filter((e) => e.dex >= from && e.dex <= to);
  if (selected.length !== to - from + 1) {
    throw new Error(`Species list covers ${selected.length} of #${from}–#${to}`);
  }
  return selected;
}
