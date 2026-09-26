/**
 * Gold/Silver/Crystal corrections to the Generation II learnset pages (plan §7.12). After them, every species'
 * level-up, TM/HM, tutor and egg moves match pret's pokegold (Gold/Silver) and pokecrystal data, as do base stats,
 * catch rates, base experience, growth rates, gender ratios and egg groups (checked 2026-09-26).
 */
import type { GameId } from '../../../../../src/app/core/domain/models';
import type { EggMovePatch, MoveDataOverride } from '../../../core/learnsets';

/**
 * Move data the pages disagree on. Values follow the other rows and the Generation I data: fixed-damage and status
 * moves have no power. pret: https://github.com/pret/pokecrystal/blob/master/data/moves/moves.asm (pokegold's is the
 * same).
 */
export const GSC_MOVE_DATA: readonly MoveDataOverride[] = [
  {
    data: { name: 'SonicBoom', type: 'normal', power: null, accuracy: 90, pp: 20 },
    reason:
      'Always deals 20 HP (EFFECT_STATIC_DAMAGE in pret); 8 learnset pages give it power 20, 3 give "—", and ' +
      "Electrode's page has both.",
  },
  {
    data: { name: 'Supersonic', type: 'normal', power: null, accuracy: 55, pp: 20 },
    reason:
      'A status move (EFFECT_CONFUSE, power 0 in pret); Magneton\'s level 11 row gives it power 20, every other row "—".',
  },
];

const GS: GameId[] = ['gold', 'silver'];
const pretEggMoves = (repo: string) =>
  `https://github.com/pret/${repo}/blob/master/data/pokemon/egg_moves.asm`;

/**
 * Egg move game flags checked against pret's egg move lists (pokegold for Gold/Silver, pokecrystal for Crystal); all
 * other rows of the 251 learnset pages agree with them. Crystal dropped some Charm, Steel Wing, Sweet Scent and Lovely
 * Kiss entries (a comment in pokecrystal's file), and the pages flag most of those rows `GS` correctly.
 */
export const GSC_EGG_MOVE_PATCHES: readonly EggMovePatch[] = [
  {
    dex: [1, 2, 3],
    move: 'Charm',
    games: GS,
    reason: `Flagged C on the pages; only in ${pretEggMoves('pokegold')} (BulbasaurEggMoves)`,
  },
  {
    dex: [16, 17, 18],
    move: 'Steel Wing',
    games: GS,
    reason: `Flagged C on the pages; only in ${pretEggMoves('pokegold')} (PidgeyEggMoves)`,
  },
  {
    dex: [194],
    move: 'Rain Dance',
    games: [],
    reason: `Flagged C on the page, but in neither ${pretEggMoves('pokegold')} nor ${pretEggMoves('pokecrystal')} (WooperEggMoves)`,
  },
];
