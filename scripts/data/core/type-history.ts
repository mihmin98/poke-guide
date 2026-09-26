/**
 * Generation-aware species types (plan §7.5). The National Dex list only has current types; entries here
 * give the older ones. Sources: Bulbapedia "Type" (Fairy retcon in Generation VI, Steel added in Generation II).
 * Entries for Pokémon introduced later are added together with their generations (Gen II: 2026-09-23;
 * checked against each species' Gen II table types when the gsc build runs).
 */
import type { PokemonType } from '../../../src/app/core/games/pokemon-types';

export interface TypeHistoryEntry {
  dex: number;
  types: PokemonType[];
  /** The types apply in this generation and every earlier one. */
  untilGeneration: number;
}

export const TYPE_HISTORY: readonly TypeHistoryEntry[] = [
  // Steel did not exist in Generation I.
  { dex: 81, types: ['electric'], untilGeneration: 1 }, // Magnemite
  { dex: 82, types: ['electric'], untilGeneration: 1 }, // Magneton
  // Fairy did not exist before Generation VI.
  { dex: 35, types: ['normal'], untilGeneration: 5 }, // Clefairy
  { dex: 36, types: ['normal'], untilGeneration: 5 }, // Clefable
  { dex: 39, types: ['normal'], untilGeneration: 5 }, // Jigglypuff (Normal/Fairy)
  { dex: 40, types: ['normal'], untilGeneration: 5 }, // Wigglytuff (Normal/Fairy)
  { dex: 122, types: ['psychic'], untilGeneration: 5 }, // Mr. Mime (Psychic/Fairy)
  { dex: 173, types: ['normal'], untilGeneration: 5 }, // Cleffa (Fairy)
  { dex: 174, types: ['normal'], untilGeneration: 5 }, // Igglybuff (Normal/Fairy)
  { dex: 175, types: ['normal'], untilGeneration: 5 }, // Togepi (Fairy)
  { dex: 176, types: ['normal', 'flying'], untilGeneration: 5 }, // Togetic (Fairy/Flying)
  { dex: 183, types: ['water'], untilGeneration: 5 }, // Marill (Water/Fairy)
  { dex: 184, types: ['water'], untilGeneration: 5 }, // Azumarill (Water/Fairy)
  { dex: 209, types: ['normal'], untilGeneration: 5 }, // Snubbull (Fairy)
  { dex: 210, types: ['normal'], untilGeneration: 5 }, // Granbull (Fairy)
];

export function typesInGeneration(
  dex: number,
  currentTypes: readonly PokemonType[],
  generation: number,
): PokemonType[] {
  const entry = TYPE_HISTORY.filter((e) => e.dex === dex && generation <= e.untilGeneration).sort(
    (a, b) => a.untilGeneration - b.untilGeneration,
  )[0];
  return [...(entry?.types ?? currentTypes)];
}

const ADDED_IN: Partial<Record<PokemonType, number>> = { dark: 2, steel: 2, fairy: 6, unknown: 2 };
/** The move-only `???` type was dropped in Generation V. */
const REMOVED_IN: Partial<Record<PokemonType, number>> = { unknown: 5 };

/** The types that exist in a generation: 15 in Gen I, 17 in Gen II–V, 18 from Gen VI (plus `???` in II–IV). */
export function typeExistsIn(type: PokemonType, generation: number): boolean {
  return generation >= (ADDED_IN[type] ?? 1) && generation < (REMOVED_IN[type] ?? Infinity);
}
