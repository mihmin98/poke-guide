/**
 * Classified notes from `List of Pokémon by catch rate` that concern Gold/Silver/Crystal (plan §7.11).
 *
 * Both notes describe Pokémon Yellow, where the catch rate byte doubles as the held item of a Pokémon traded to
 * Generation II. Gold, Silver and Crystal capture with their own base stats: Pikachu 190 and Kadabra 100 in pret's
 * pokegold and pokecrystal `data/pokemon/base_stats/{pikachu,kadabra}.asm`, the values the list gives.
 */
import type { CatchRateNoteClassification } from '../../../core/catch-rate-history';

const reason = (species: string, value: number) =>
  `A Pokémon Yellow value (a held item after a trade to Generation II); Generation II captures ${species} with ` +
  `${value} (pret pokegold/pokecrystal data/pokemon/base_stats).`;

export const GSC_CATCH_RATE_NOTES: readonly CatchRateNoteClassification[] = [
  {
    dex: 25,
    note: 'The first partner Pikachu in Yellow has its catch rate value set to 163',
    kind: 'note-only',
    reason: reason('Pikachu', 190),
  },
  {
    dex: 64,
    note: 'Wild Kadabra in Yellow have their catch rate value set to 96 after capture',
    kind: 'note-only',
    reason: reason('Kadabra', 100),
  },
];
