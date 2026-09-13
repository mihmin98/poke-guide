/**
 * Generation-aware species types (plan §7.5). The National Dex list only has current types; entries here
 * give the older ones. Sources: Bulbapedia "Type" (Fairy retcon in Generation VI, Steel added in Generation II).
 * Gen II–V entries for Pokémon introduced after Gen I are added together with their generations.
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
];

export function typesInGeneration(dex: number, currentTypes: readonly PokemonType[], generation: number): PokemonType[] {
  const entry = TYPE_HISTORY.filter((e) => e.dex === dex && generation <= e.untilGeneration).sort(
    (a, b) => a.untilGeneration - b.untilGeneration,
  )[0];
  return [...(entry?.types ?? currentTypes)];
}

const ADDED_IN: Partial<Record<PokemonType, number>> = { dark: 2, steel: 2, fairy: 6 };

/** The types that exist in a generation: 15 in Gen I, 17 in Gen II–V, 18 from Gen VI. */
export function typeExistsIn(type: PokemonType, generation: number): boolean {
  return generation >= (ADDED_IN[type] ?? 1);
}
