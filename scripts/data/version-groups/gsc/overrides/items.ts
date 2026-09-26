/**
 * Gold/Silver/Crystal item overrides (plan §7.13), triaged against the walkthroughs and pret pokegold/pokecrystal
 * (`maps/*.asm`: `itemball`, `hiddenitem`, `verbosegiveitem`). Location pages leave out the Gym leader TMs (Gym pages
 * aren't locations) and state few gates, so the Basement Key, Tin Tower and Ruins of Alph gates are added here.
 */
import type { GameId } from '../../../../../src/app/core/domain/models';
import type {
  ItemAddition,
  ItemOverrides,
  ItemPatch,
  ItemRequirementOverride,
  WalkthroughAccepted,
} from '../../../core/location-items';

const ALL: GameId[] = ['gold', 'silver', 'crystal'];
const GS: GameId[] = ['gold', 'silver'];
const CRYSTAL: GameId[] = ['crystal'];
const gsWalkthrough = (part: number) => `Walkthrough:Pokémon Gold and Silver/Part ${part}`;
const crystalWalkthrough = (part: number) => `Walkthrough:Pokémon Crystal/Part ${part}`;

function gymTm(locationId: string, name: string, leader: string, part: number): ItemAddition {
  return {
    locationId,
    item: {
      name,
      quantity: 1,
      games: ALL,
      obtain: 'reward',
      subArea: 'Gym',
      where: `From ${leader}, after defeating them`,
    },
    sourcePage: gsWalkthrough(part),
    reason: 'Gym leader TM (pret maps/*Gym.asm); Gym pages are not locations',
  };
}

/** A Radio Tower reward handed out once Team Rocket is driven out (Part 12), not on the Part 6 visit. */
function afterTakeover(itemId: string, subArea: string | null, games: GameId[] = ALL): ItemPatch {
  return {
    locationId: 'goldenrod-radio-tower',
    itemId,
    ...(subArea !== null ? { subArea } : {}),
    set: { fromPart: Object.fromEntries(games.map((game) => [game, 12])) },
    sourcePage: gsWalkthrough(12),
    reason:
      'Given after Team Rocket leaves the Radio Tower in Part 12; the tower itself is placed at Part 6',
  };
}

const accept = (itemId: string, games: GameId[], reason: string): WalkthroughAccepted => ({
  itemId,
  games,
  reason,
});

function requires(
  locationId: string,
  target: { itemId: string; subArea?: string } | { subArea: string },
  unlocks: string[][],
  sourcePage: string,
  reason: string,
): ItemRequirementOverride {
  return { locationId, ...target, requires: unlocks, sourcePage, reason };
}

export const GSC_ITEM_OVERRIDES: ItemOverrides = {
  requirementPhrases: {
    // Walkthroughs sometimes name the move without {{m|…}}.
    Surf: 'surf',
    Waterfall: 'waterfall',
    // Phone-call gifts that need a species in the party: a condition, not an unlock.
    'Marill in the party': null,
    'Pikachu in the party': null,
  },
  add: [
    gymTm('violet-city', 'TM31 Mud-Slap', 'Falkner', 3),
    gymTm('azalea-town', 'TM49 Fury Cutter', 'Bugsy', 5),
    gymTm('goldenrod-city', 'TM45 Attract', 'Whitney', 6),
    gymTm('ecruteak-city', 'TM30 Shadow Ball', 'Morty', 8),
    gymTm('olivine-city', 'TM23 Iron Tail', 'Jasmine', 9),
    gymTm('cianwood-city', 'TM01 DynamicPunch', 'Chuck', 10),
    gymTm('mahogany-town', 'TM16 Icy Wind', 'Pryce', 11),
    gymTm('celadon-city', 'TM19 Giga Drain', 'Erika', 20),
    gymTm('fuchsia-city', 'TM06 Toxic', 'Janine', 21),
    {
      // pret pokegold/pokecrystal maps/CeruleanGym.asm: `hiddenitem MACHINE_PART`.
      locationId: 'cerulean-city',
      item: {
        name: 'Machine Part',
        quantity: 1,
        games: ALL,
        obtain: 'pickup',
        hidden: true,
        subArea: 'Gym',
        where: 'In the water, northwest part of the enclosed area',
      },
      sourcePage: gsWalkthrough(19),
      reason: 'Gym pages are not locations',
    },
  ],
  remove: [
    {
      // The farmhouse and its paddock are also on the Route 39 page, which pret places them under
      // (maps/Route39Farmhouse.asm gives the TM, maps/Route39.asm holds the hidden Nugget).
      locationId: 'moomoo-farm',
      itemId: 'tm13-snore',
      sourcePage: 'Johto Route 39',
      reason: 'The same TM as Route 39\'s "From the farm owner for healing Miltank"',
    },
    {
      locationId: 'moomoo-farm',
      itemId: 'nugget',
      sourcePage: 'Johto Route 39',
      reason: 'The same hidden Nugget as Route 39\'s "Between the Miltank"',
    },
    // The international cartridges have no GS Ball event (the 3DS Virtual Console added it; Celebi is event-only
    // here) and no Mobile Adapter features.
    {
      locationId: 'goldenrod-city',
      itemId: 'gs-ball',
      sourcePage: 'Goldenrod City',
      reason: 'Virtual Console only',
    },
    {
      locationId: 'azalea-town',
      itemId: 'gs-ball',
      sourcePage: 'Azalea Town',
      reason: 'Virtual Console only (Kurt hands back the same GS Ball)',
    },
    {
      locationId: 'route-34',
      itemId: 'egg-ticket',
      sourcePage: 'Johto Route 34',
      reason: 'Japanese version only (Mobile Game Boy Adapter)',
    },
  ],
  patch: [
    afterTakeover('tm11-sunny-day', '3F'),
    afterTakeover('pink-bow', '4F'),
    afterTakeover('basement-key', '5F'),
    afterTakeover('rainbow-wing', null, ['gold']),
    afterTakeover('silver-wing', null, ['silver']),
    afterTakeover('clear-bell', null, CRYSTAL),
    {
      locationId: 'tin-tower',
      itemId: 'rainbow-wing',
      set: { fromPart: { crystal: 29 } },
      sourcePage: crystalWalkthrough(29),
      reason: 'Given after catching the legendary beasts and entering the Hall of Fame (Part 29)',
    },
  ],
  requires: [
    // Behind the Underground's basement door (the switch rooms and the Warehouse).
    requires(
      'goldenrod-underground',
      { subArea: 'B2F' },
      [['basement-key']],
      gsWalkthrough(12),
      'The door maze is behind the basement door, which the Basement Key opens (walkthrough Part 12)',
    ),
    ...['ultra-ball', 'max-ether', 'tm35-sleep-talk', 'card-key'].map((itemId) =>
      requires(
        'goldenrod-underground',
        { itemId },
        [['basement-key']],
        gsWalkthrough(12),
        'In the Warehouse, beyond the door maze (walkthrough Part 12)',
      ),
    ),
    // Mt. Mortar: "Surf and Waterfall are required to reach this area."
    requires(
      'mt-mortar',
      { subArea: '2F' },
      [['surf'], ['waterfall']],
      'Mt. Mortar',
      'The 2F items heading says Surf and Waterfall are required',
    ),
    // Tin Tower's upper floors: the Rainbow Wing opens the way up (Crystal's 1F is visited in Part 12 for Suicune).
    ...['3F', '4F', '5F', '6F', '7F', '8F', '9F'].map((subArea) =>
      requires(
        'tin-tower',
        { subArea },
        [['rainbow-wing']],
        crystalWalkthrough(29),
        'The upper floors are only reached with the Rainbow Wing',
      ),
    ),
    requires(
      'dark-cave',
      { itemId: 'tm13-snore' },
      [['surf']],
      'Dark Cave',
      'Geography: reached by surfing southwest from the Route 45 entrance; ledges block it from the south',
    ),
    requires(
      'route-2',
      { itemId: 'elixer' },
      [['cut']],
      gsWalkthrough(23),
      'The walkthrough says "Southeast corner (requires Cut)"',
    ),
    requires(
      'dragons-den',
      { itemId: 'tm24-dragonbreath' },
      [['whirlpool']],
      gsWalkthrough(13),
      "Given after the Dragon Fang (Gold/Silver) or the Dragon Shrine's test (Crystal), both past whirlpools",
    ),
    // Crystal's hidden rooms: the chamber's entrance (Ruins of Alph, "Puzzle chambers"; pret
    // maps/UnionCaveB1F.asm puts the Strength boulder on the Omanyte side) and what opens its far wall.
    requires(
      'ruins-of-alph',
      { subArea: 'Lower-right entrance 2' },
      [['surf'], ['flash']],
      'Ruins of Alph',
      'Aerodactyl chamber: across the southern pond; Flash opens the hidden room',
    ),
    requires(
      'ruins-of-alph',
      { subArea: 'Upper-left entrance 2' },
      [['surf'], ['ho-oh']],
      'Ruins of Alph',
      'Ho-Oh chamber: through the Union Cave basement; Ho-Oh leading the party opens the hidden room',
    ),
    requires(
      'ruins-of-alph',
      { subArea: 'Lower-left entrance 2' },
      [['surf'], ['strength'], ['water-stone']],
      'Ruins of Alph',
      'Omanyte chamber: through the Union Cave basement past a boulder; a Water Stone opens the hidden room',
    ),
  ],
  choiceGroups: [],
  walkthroughAccepted: [
    // The prize windows are {{shop}} blocks in the walkthroughs, not item rows (as in Red/Blue/Yellow).
    ...[
      'tm25-thunder',
      'tm14-blizzard',
      'tm38-fire-blast',
      'tm32-double-team',
      'tm29-psychic',
      'tm15-hyper-beam',
    ].map((itemId) =>
      accept(itemId, ALL, 'Game Corner prize: a {{shop}} block in the walkthrough'),
    ),
    // Listed in both Part 6 (Goldenrod) and Part 12 (the takeover), with different text.
    ...['tm11-sunny-day', 'basement-key', 'pink-bow'].map((itemId) =>
      accept(itemId, ALL, 'The walkthrough lists the Radio Tower rewards in Parts 6 and 12'),
    ),
    accept('rainbow-wing', GS, 'The walkthrough lists the Radio Tower rewards in Parts 6 and 12'),
    accept('silver-wing', GS, 'The walkthrough lists the Radio Tower rewards in Parts 6 and 12'),
    accept(
      'clear-bell',
      CRYSTAL,
      'The walkthrough lists the Radio Tower rewards in Parts 6 and 12',
    ),
    // Walkthrough rows that pret confirms but the walkthrough leaves out.
    ...['everstone', 'fire-stone', 'leaf-stone', 'thunderstone', 'water-stone'].map((itemId) =>
      accept(
        itemId,
        ALL,
        "Bill's grandfather's gifts (pret maps/BillsHouse.asm) are not in the walkthrough",
      ),
    ),
    accept(
      'exp-share',
      ALL,
      "Mr. Pokémon's Exp. Share for the Red Scale (pret MrPokemonsHouse.asm)",
    ),
    accept('expn-card', ALL, 'The EXPN Card is not an item row in the walkthrough'),
    accept('berserk-gene', CRYSTAL, 'Cerulean City hidden item (pret CeruleanCity.asm)'),
    accept('max-ether', CRYSTAL, "Mt. Mortar B1F's Max Ether (pret MountMortarB1F.asm)"),
    accept('iron', CRYSTAL, "Hiker Parry's rematch gift on Route 45 (pret Route45.asm)"),
    accept(
      'max-elixer',
      CRYSTAL,
      "Dragon's Den's Max Elixer near the Twins (pret DragonsDenB1F.asm)",
    ),
    // Walkthrough rows for things that aren't items here.
    accept(
      'machine-part',
      CRYSTAL,
      'The Crystal walkthrough flags its Machine Part row Gold/Silver only',
    ),
    accept('gs-ball', CRYSTAL, 'Virtual Console only: left out'),
    accept('odd-egg', CRYSTAL, 'The Odd Egg is a Pokémon (an egg encounter), not an item'),
    // Its "Southwest chamber" (Surf and Strength) lists the Ho-Oh chamber's items; pret has them in
    // RuinsOfAlphHoOhItemRoom.asm, and the Strength boulder (UnionCaveB1F.asm) is on the Omanyte side.
    ...['gold-berry', 'revival-herb', 'charcoal'].map((itemId) => ({
      ...accept(itemId, CRYSTAL, 'The walkthrough swaps the Ho-Oh and Omanyte chambers'),
      difference: 'requirements' as const,
    })),
  ],
};
