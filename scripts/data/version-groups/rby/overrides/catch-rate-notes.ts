/**
 * Classified notes from `List of Pokémon by catch rate` (rev 4609622) that concern Red/Blue/Yellow (plan §7.11).
 *
 * In Generation I the catch rate byte doubles as the held item when a Pokémon is traded to Generation II
 * (the page's "Generation I held items" section). Whether a Yellow value also changes capture was checked in
 * the pret disassembly: `LoadEnemyMonData` copies the species' base-stats catch rate into
 * `wEnemyMonActualCatchRate`, which `ItemUseBall` uses (pokeyellow `engine/battle/core.asm`,
 * `engine/items/item_effects.asm`).
 */
import type { CatchRateNoteClassification } from '../../../core/catch-rate-history';

const PRET_YELLOW_BASE_STATS =
  'https://github.com/pret/pokeyellow/blob/master/data/pokemon/base_stats';

export const RBY_CATCH_RATE_NOTES: readonly CatchRateNoteClassification[] = [
  {
    dex: 25,
    note: 'The first partner Pikachu in Yellow has its catch rate value set to 163',
    kind: 'note-only',
    reason:
      'The partner Pikachu is a gift, never captured; 163 only gives it a Light Ball when traded to Generation II.',
  },
  {
    dex: 64,
    note: 'Wild Kadabra in Yellow have their catch rate value set to 96 after capture',
    kind: 'note-only',
    reason:
      'Written after capture (`ld [wBoxMon1CatchRate], a` in pokeyellow item_effects.asm), so capture uses 100; ' +
      '96 only gives it a TwistedSpoon when traded to Generation II.',
  },
  {
    dex: 148,
    note: '27 in Pokémon Yellow',
    kind: 'override',
    value: 27,
    games: ['yellow'],
    reason: `Yellow's base stats store the catch rate as 27 (${PRET_YELLOW_BASE_STATS}/dragonair.asm; pokered has 45), and capture reads it.`,
  },
  {
    dex: 149,
    note: '9 in Pokémon Yellow',
    kind: 'override',
    value: 9,
    games: ['yellow'],
    reason: `Yellow's base stats store the catch rate as 9 (${PRET_YELLOW_BASE_STATS}/dragonite.asm; pokered has 45), and capture reads it.`,
  },
];
