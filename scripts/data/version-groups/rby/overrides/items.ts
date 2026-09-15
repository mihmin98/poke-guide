/**
 * Red/Blue/Yellow item overrides (plan §7.13). Location pages leave out Gym leader TMs (Gym pages aren't locations)
 * and the Department Store rooftop TMs (a game-column table), and some gates only the walkthrough states.
 * `Walkthrough:Pokémon Yellow/Part N` lists the same rows as the Red and Blue part cited here.
 */
import type { GameId } from '../../../../../src/app/core/domain/models';
import type { ItemAddition, ItemOverrides } from '../../../core/location-items';

const ALL: GameId[] = ['red', 'blue', 'yellow'];
const walkthrough = (part: number) => `Walkthrough:Pokémon Red and Blue/Part ${part}`;

function gymTm(
  locationId: string,
  name: string,
  leader: string,
  part: number,
  extra: Partial<ItemAddition['item']> = {},
): ItemAddition {
  return {
    locationId,
    item: {
      name,
      quantity: 1,
      games: ALL,
      obtain: 'reward',
      subArea: 'Gym',
      where: `From ${leader}, after defeating them`,
      ...extra,
    },
    sourcePage: walkthrough(part),
    reason: 'Gym leader TM; Gym pages are not locations',
  };
}

function rooftopTm(name: string, drink: string): ItemAddition {
  return {
    locationId: 'celadon-department-store',
    item: {
      name,
      quantity: 1,
      games: ALL,
      obtain: 'gift',
      subArea: 'Rooftop',
      where: `From the girl on the rooftop, after giving her a ${drink}`,
    },
    sourcePage: 'Celadon Department Store',
    reason: 'Listed in the "TMs from the girl on the rooftop" table, not as Itemlist rows',
  };
}

export const RBY_ITEM_OVERRIDES: ItemOverrides = {
  requirementPhrases: {
    // FireRed/LeafGreen and Let's Go alternatives written next to the Gen I move.
    'Chop Down': null,
    'defeating Jr. Trainer♂': 'route-25-jr-trainer',
  },
  add: [
    gymTm('pewter-city', 'TM34 Bide', 'Brock', 3),
    gymTm('cerulean-city', 'TM11 BubbleBeam', 'Misty', 5),
    gymTm('vermilion-city', 'TM24 Thunderbolt', 'Lt. Surge', 6, { requires: [['cut']] }),
    gymTm('celadon-city', 'TM21 Mega Drain', 'Erika', 9),
    gymTm('saffron-city', 'TM46 Psywave', 'Sabrina', 10),
    gymTm('fuchsia-city', 'TM06 Toxic', 'Koga', 11),
    // The Cinnabar Gym door is locked until the player has the Secret Key from the Pokémon Mansion (Part 13).
    gymTm('cinnabar-island', 'TM38 Fire Blast', 'Blaine', 13, { requires: [['secret-key']] }),
    // The walkthrough lists it with Viridian City (Part 2), but the Gym only opens in Part 14.
    gymTm('viridian-city', 'TM27 Fissure', 'Giovanni', 2, {
      fromPart: { red: 14, blue: 14, yellow: 14 },
    }),
    rooftopTm('TM13 Ice Beam', 'Fresh Water'),
    rooftopTm('TM48 Rock Slide', 'Soda Pop'),
    rooftopTm('TM49 Tri Attack', 'Lemonade'),
    {
      locationId: 'pallet-town',
      item: {
        name: 'Potion',
        quantity: 1,
        games: ALL,
        obtain: 'gift',
        subArea: "Player's house",
        where: "Stored in the player's PC at the start of the game",
      },
      sourcePage: walkthrough(1),
      reason: "The player's house is not a location page",
    },
    {
      // pret pokered/pokeyellow data/maps/objects/ViridianGym.asm: REVIVE item ball at (16, 9).
      locationId: 'viridian-city',
      item: {
        name: 'Revive',
        quantity: 1,
        games: ALL,
        obtain: 'pickup',
        subArea: 'Gym',
        where: 'Inside Viridian Gym',
        fromPart: { red: 14, blue: 14, yellow: 14 },
      },
      sourcePage: walkthrough(2),
      reason: 'Gym pages are not locations; the Gym only opens in Part 14',
    },
  ],
  patch: [
    {
      // pret pokered scripts/Route15Gate2F.asm gives EXP_ALL after 50 species; Exp. Share is the Gen II+ item.
      locationId: 'route-15',
      itemId: 'exp-share',
      set: { name: 'Exp. All' },
      sourcePage: walkthrough(12),
      reason:
        'The location page uses the later name; Gen I has EXP.ALL (https://github.com/pret/pokered/blob/master/scripts/Route15Gate2F.asm)',
    },
  ],
  walkthroughAccepted: [
    {
      itemId: 'poke-ball',
      games: ALL,
      reason: "Oak's 5 Poké Balls (Professor Oak's Laboratory) are not in the walkthrough",
    },
    // The Game Corner TM prizes are in the walkthroughs, but as a {{shop}} block rather than
    // {{Itemlist}} rows, so the cross-check (which only counts item rows) sees none.
    ...(['tm23-dragon-rage', 'tm15-hyper-beam', 'tm50-substitute'] as const).map((itemId) => ({
      itemId,
      games: ALL,
      reason: 'Game Corner prize: the walkthrough lists it in a {{shop}} block, not as an item row',
    })),
  ],
  walkthroughGames: [
    {
      page: 'Walkthrough:Pokémon Yellow/Part 3',
      games: ['yellow'],
      reason:
        'Its Viridian Forest rows are flagged R/B; pret pokeyellow ViridianForest.asm matches the Yellow rows',
    },
  ],
  requires: [
    ...['protein', 'hp-up', 'x-accuracy', 'tm03-swords-dance'].map((itemId) => ({
      locationId: 'silph-co',
      itemId,
      requires: [['card-key']],
      sourcePage: walkthrough(10),
      reason: 'Behind a locked door (walkthrough: "requires the Card Key")',
    })),
    ...['tm43-sky-attack', 'rare-candy'].map((itemId) => ({
      locationId: 'victory-road',
      itemId,
      requires: [['strength']],
      sourcePage: walkthrough(15),
      reason: 'Behind a boulder (walkthrough: "requires Strength")',
    })),
  ],
  choiceGroups: [
    { locationId: 'mt-moon', itemIds: ['dome-fossil', 'helix-fossil'], groupId: 'mt-moon-fossil' },
  ],
};
