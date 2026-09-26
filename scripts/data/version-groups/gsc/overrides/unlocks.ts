/**
 * Gold/Silver/Crystal unlocks (plan §7.7, §7.13): field moves, key items and story gates that encounters and items
 * can require. `part` is the walkthrough part where the unlock is obtained (the Gold/Silver and Crystal walkthroughs
 * share their part numbers). A field move counts from the later of its HM or TM and the badge that allows it outside
 * battle. Sources: the `Walkthrough:Pokémon Gold and Silver` and `Walkthrough:Pokémon Crystal` parts named below.
 */
import type { GameId, Unlock } from '../../../../../src/app/core/domain/models';

const SHARED: readonly Unlock[] = [
  // Part 3: HM05 from the Elder atop Sprout Tower, usable with the Zephyr Badge from the same part.
  { id: 'flash', label: 'Flash', kind: 'move', locationId: 'sprout-tower', part: 3 },
  // Part 4: the Fishing Guru in the Route 32 Pokémon Center.
  { id: 'old-rod', label: 'Old Rod', kind: 'key-item', locationId: 'route-32', part: 4 },
  // Part 5: TM02 from the man in Ilex Forest; HM01 from the Charcoal Kiln's owner, usable with the Hive Badge.
  { id: 'headbutt', label: 'Headbutt', kind: 'move', locationId: 'ilex-forest', part: 5 },
  { id: 'cut', label: 'Cut', kind: 'move', locationId: 'ilex-forest', part: 5 },
  // Part 6: south of the three shops in Goldenrod Underground; the Flower Shop after the Plain Badge.
  {
    id: 'coin-case',
    label: 'Coin Case',
    kind: 'key-item',
    locationId: 'goldenrod-underground',
    part: 6,
  },
  {
    id: 'squirtbottle',
    label: 'SquirtBottle',
    kind: 'key-item',
    locationId: 'goldenrod-city',
    part: 6,
  },
  // Part 7: TM08 from the man east of the Sudowoodo, after removing it.
  { id: 'rock-smash', label: 'Rock Smash', kind: 'move', locationId: 'route-36', part: 7 },
  // Part 8: HM03 at the Dance Theater, usable with the Fog Badge from the same part.
  { id: 'surf', label: 'Surf', kind: 'move', locationId: 'ecruteak-city', part: 8 },
  // Part 9: HM04 in the Olivine Café (Plain Badge, Part 6); the Fishing Guru south of the Gym.
  { id: 'strength', label: 'Strength', kind: 'move', locationId: 'olivine-city', part: 9 },
  { id: 'good-rod', label: 'Good Rod', kind: 'key-item', locationId: 'olivine-city', part: 9 },
  // Part 11: HM06 from Lance, usable with the Glacier Badge from the same part.
  { id: 'whirlpool', label: 'Whirlpool', kind: 'move', locationId: 'team-rocket-hq', part: 11 },
  // Part 12: from the Rocket posing as the Director on the Radio Tower's 5F; opens the Underground's basement door.
  {
    id: 'basement-key',
    label: 'Basement Key',
    kind: 'key-item',
    locationId: 'goldenrod-radio-tower',
    part: 12,
  },
  // Part 12: from the Director in the Underground Warehouse.
  {
    id: 'card-key',
    label: 'Card Key',
    kind: 'key-item',
    locationId: 'goldenrod-underground',
    part: 12,
  },
  // HM07 lies in the Ice Path (Part 12), but it can only be used with the Rising Badge (Part 13).
  { id: 'waterfall', label: 'Waterfall', kind: 'move', locationId: 'ice-path', part: 13 },
  // From Professor Elm after entering the Hall of Fame, at the end of Part 15.
  {
    id: 'ss-ticket',
    label: 'S.S. Ticket',
    kind: 'key-item',
    locationId: 'new-bark-town',
    part: 15,
  },
  // Part 19: from the Kanto Radio Tower's manager once the Power Plant runs again; wakes Vermilion's Snorlax.
  {
    id: 'expn-card',
    label: 'EXPN Card',
    kind: 'key-item',
    locationId: 'kanto-radio-tower',
    part: 19,
  },
  // Part 22: the Fishing Guru's younger brother on Route 12.
  { id: 'super-rod', label: 'Super Rod', kind: 'key-item', locationId: 'route-12', part: 22 },
];

/**
 * Crystal's Ruins of Alph hidden rooms (Ruins of Alph, "Puzzle chambers"): the Omanyte chamber's opens with a Water
 * Stone in the Bag (the first one that isn't a random phone gift is from Bill's grandfather, Part 19), the Ho-Oh
 * chamber's with Ho-Oh leading the party (caught in Tin Tower, Part 29).
 */
const RUINS_OF_ALPH: readonly Unlock[] = [
  {
    id: 'water-stone',
    label: 'Water Stone',
    kind: 'key-item',
    locationId: 'sea-cottage',
    part: 19,
  },
  {
    id: 'ho-oh',
    label: 'Ho-Oh leading the party',
    kind: 'story',
    locationId: 'tin-tower',
    part: 29,
  },
];

/** A wing from the Goldenrod Radio Tower's Director after Team Rocket leaves (Part 12). */
const directorWing = (id: string, label: string): Unlock => ({
  id,
  label,
  kind: 'key-item',
  locationId: 'goldenrod-radio-tower',
  part: 12,
});

/** A wing from the old man near Pewter City's east exit (Part 23). */
const pewterWing = (id: string, label: string): Unlock => ({
  id,
  label,
  kind: 'key-item',
  locationId: 'pewter-city',
  part: 23,
});

export const GSC_UNLOCKS: Partial<Record<GameId, readonly Unlock[]>> = {
  gold: [
    ...SHARED,
    directorWing('rainbow-wing', 'Rainbow Wing'),
    pewterWing('silver-wing', 'Silver Wing'),
  ],
  silver: [
    ...SHARED,
    directorWing('silver-wing', 'Silver Wing'),
    pewterWing('rainbow-wing', 'Rainbow Wing'),
  ],
  crystal: [
    ...SHARED,
    ...RUINS_OF_ALPH,
    directorWing('clear-bell', 'Clear Bell'),
    pewterWing('silver-wing', 'Silver Wing'),
    // Part 29: from one of the Wise Trio, after catching the legendary beasts and entering the Hall of Fame.
    {
      id: 'rainbow-wing',
      label: 'Rainbow Wing',
      kind: 'key-item',
      locationId: 'tin-tower',
      part: 29,
    },
  ],
};
