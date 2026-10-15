/**
 * Red/Blue/Yellow story milestones (plan §7.14, Phase 11), in walkthrough order. Written from the walkthrough
 * part pages (`Walkthrough:Pokémon Red and Blue/Part N`, `Walkthrough:Pokémon Yellow/Part N`); the build
 * cross-checks them against those pages' badges and `{{Party}}` battles.
 *
 * A milestone at a location from an earlier part (a revisit) takes `after`: the location of its own part it follows
 * in the Story and Guide journey (plan §7.14, §13.13).
 *
 * A `gym` or `battle` milestone names its `trainer` as the part page's `{{Party}}` block does ("Blue", "Executive"),
 * and the build attaches that party's team (plan §7.14, Phase 19). Battles with no party block on the page have none.
 *
 * Ids are a contract: `milestone-numbers.json` maps them to the numbers profiles store. Never rename one;
 * retire its number below and add a new id instead.
 */
import type { GameId } from '../../../../../src/app/core/domain/models';
import type { MilestoneDefinition, RetiredMilestone } from '../../../core/milestone-numbers';

const all = (part: number): Partial<Record<GameId, number>> => ({
  red: part,
  blue: part,
  yellow: part,
});
const redBlue = (part: number): Partial<Record<GameId, number>> => ({ red: part, blue: part });
const yellow = (part: number): Partial<Record<GameId, number>> => ({ yellow: part });

const gym = (
  leader: string,
  badge: string,
  tm: string,
  locationId: string,
  part: number,
): MilestoneDefinition => ({
  id: `gym-${leader.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  label: `Defeat ${leader}`,
  kind: 'gym',
  trainer: leader,
  part: all(part),
  locationId,
  detail: `${badge} Badge · ${tm}`,
  badge,
});

const rival = (
  n: number,
  locationId: string,
  part: number,
  detail: string,
): MilestoneDefinition => ({
  id: `rival-${n}`,
  label: `Rival battle ${n}`,
  kind: 'battle',
  trainer: 'Blue',
  part: all(part),
  locationId,
  detail,
});

const jessieJames = (id: string, locationId: string, part: number): MilestoneDefinition => ({
  id: `jessie-james-${id}`,
  label: 'Battle Jessie and James',
  kind: 'battle',
  // The page names the pair's party "Rocket".
  trainer: 'Rocket',
  part: yellow(part),
  locationId,
});

export const RBY_MILESTONES: readonly MilestoneDefinition[] = [
  // Part 1
  {
    id: 'choose-starter',
    label: 'Choose your first Pokémon',
    kind: 'gift',
    part: redBlue(1),
    locationId: 'oaks-lab',
    detail: 'Bulbasaur, Charmander or Squirtle',
  },
  {
    id: 'receive-pikachu',
    label: 'Receive Pikachu',
    kind: 'gift',
    part: yellow(1),
    locationId: 'oaks-lab',
    detail: 'From Professor Oak',
    dex: 25,
  },
  rival(1, 'oaks-lab', 1, "In Professor Oak's Lab"),
  // Part 2
  {
    id: 'oaks-parcel',
    label: "Deliver Oak's Parcel",
    kind: 'event',
    part: all(2),
    locationId: 'oaks-lab',
    after: 'viridian-city',
    detail: "From Viridian City's Poké Mart; Professor Oak gives you the Pokédex",
  },
  { ...rival(2, 'route-22', 2, 'On Route 22'), optional: true },
  // Part 3
  gym('Brock', 'Boulder', 'TM34 Bide', 'pewter-city', 3),
  // Part 4
  jessieJames('mt-moon', 'mt-moon', 4),
  // Part 5
  gym('Misty', 'Cascade', 'TM11 BubbleBeam', 'cerulean-city', 5),
  rival(3, 'cerulean-city', 5, 'North of Cerulean City'),
  {
    id: 'receive-bulbasaur',
    label: 'Receive Bulbasaur',
    kind: 'gift',
    part: yellow(5),
    locationId: 'cerulean-city',
    detail: 'From a girl in Cerulean City, if Pikachu is happy enough',
    dex: 1,
    optional: true,
  },
  {
    id: 'receive-charmander',
    label: 'Receive Charmander',
    kind: 'gift',
    part: yellow(5),
    locationId: 'route-24',
    detail: 'From a Trainer on Route 24',
    dex: 4,
    optional: true,
  },
  {
    id: 'route-25-jr-trainer',
    label: 'Defeat the Jr. Trainer♂ on Route 25',
    kind: 'battle',
    part: all(5),
    locationId: 'route-25',
    grants: ['route-25-jr-trainer'],
    optional: true,
  },
  {
    id: 'help-bill',
    label: 'Help Bill',
    kind: 'event',
    part: all(5),
    locationId: 'sea-cottage',
    detail: 'He gives you the S.S. Ticket',
    grants: ['ss-ticket'],
  },
  // Part 6
  {
    id: 'old-rod',
    label: 'Get the Old Rod',
    kind: 'key-item',
    part: all(6),
    locationId: 'vermilion-city',
    detail: 'From the Fishing Guru',
    grants: ['old-rod'],
    optional: true,
  },
  {
    id: 'bicycle',
    label: 'Get the Bicycle',
    kind: 'key-item',
    part: all(6),
    locationId: 'cerulean-city',
    detail: "Trade the Bike Voucher from Vermilion City's Pokémon Fan Club at the Bike Shop",
    optional: true,
  },
  rival(4, 'ss-anne', 6, 'On the S.S. Anne'),
  {
    id: 'ss-anne-captain',
    label: "Help the S.S. Anne's captain",
    kind: 'key-item',
    part: all(6),
    locationId: 'ss-anne',
    detail: 'HM01 Cut',
    grants: ['cut'],
  },
  gym('Lt. Surge', 'Thunder', 'TM24 Thunderbolt', 'vermilion-city', 6),
  {
    id: 'receive-squirtle',
    label: 'Receive Squirtle',
    kind: 'gift',
    part: yellow(6),
    locationId: 'vermilion-city',
    detail: 'From Officer Jenny, after the Thunder Badge',
    dex: 7,
    optional: true,
  },
  // Part 7
  {
    id: 'hm05-flash',
    label: 'Get HM05 Flash',
    kind: 'key-item',
    part: all(7),
    locationId: 'route-2',
    // Route 2's east side is reached through Diglett's Cave (the part's title order).
    after: 'digletts-cave',
    detail: "From Professor Oak's aide, after catching 10 different species",
    optional: true,
  },
  // Part 9
  {
    id: 'receive-eevee',
    label: 'Receive Eevee',
    kind: 'gift',
    part: all(9),
    locationId: 'celadon-condominiums',
    detail: 'On the roof of Celadon Mansion',
    dex: 133,
    optional: true,
  },
  {
    id: 'coin-case',
    label: 'Get the Coin Case',
    kind: 'key-item',
    part: all(9),
    locationId: 'celadon-city',
    detail: 'From a man in the restaurant',
    grants: ['coin-case'],
    optional: true,
  },
  gym('Erika', 'Rainbow', 'TM21 Mega Drain', 'celadon-city', 9),
  jessieJames('rocket-hideout', 'team-rocket-hideout', 9),
  {
    id: 'lift-key',
    label: 'Get the Lift Key',
    kind: 'key-item',
    part: all(9),
    locationId: 'team-rocket-hideout',
    grants: ['lift-key'],
  },
  {
    id: 'giovanni-rocket-hideout',
    label: 'Defeat Giovanni in the Rocket Hideout',
    kind: 'battle',
    trainer: 'Giovanni',
    part: all(9),
    locationId: 'team-rocket-hideout',
    detail: 'He leaves the Silph Scope behind',
    grants: ['silph-scope'],
  },
  rival(5, 'pokemon-tower', 9, 'In Pokémon Tower'),
  jessieJames('pokemon-tower', 'pokemon-tower', 9),
  {
    id: 'rescue-mr-fuji',
    label: 'Rescue Mr. Fuji',
    kind: 'event',
    part: all(9),
    locationId: 'pokemon-tower',
    detail: "Calm the Marowak's spirit, then Mr. Fuji gives you the Poké Flute",
    grants: ['poke-flute'],
  },
  // Part 10
  {
    id: 'saffron-gate-drink',
    label: 'Give the gate guards a drink',
    kind: 'event',
    part: all(10),
    locationId: 'saffron-city',
    detail: "Fresh Water, Soda Pop or Lemonade from Celadon Department Store's roof",
  },
  {
    id: 'card-key',
    label: 'Get the Card Key',
    kind: 'key-item',
    part: all(10),
    locationId: 'silph-co',
    grants: ['card-key'],
  },
  rival(6, 'silph-co', 10, 'In Silph Co.'),
  jessieJames('silph-co', 'silph-co', 10),
  {
    id: 'receive-lapras',
    label: 'Receive Lapras',
    kind: 'gift',
    part: all(10),
    locationId: 'silph-co',
    detail: 'From an employee on 7F',
    dex: 131,
    optional: true,
  },
  {
    id: 'giovanni-silph-co',
    label: 'Defeat Giovanni at Silph Co.',
    kind: 'battle',
    trainer: 'Giovanni',
    part: all(10),
    locationId: 'silph-co',
    detail: 'The president gives you the Master Ball',
  },
  {
    id: 'karate-master',
    label: 'Defeat the Karate Master',
    kind: 'battle',
    trainer: 'Blackbelt',
    part: all(10),
    locationId: 'fighting-dojo',
    detail: 'Then choose Hitmonlee or Hitmonchan',
    optional: true,
  },
  gym('Sabrina', 'Marsh', 'TM46 Psywave', 'saffron-city', 10),
  // Part 11
  {
    id: 'snorlax-route-16',
    label: 'Wake the Snorlax on Route 16',
    kind: 'encounter',
    part: all(11),
    locationId: 'route-16',
    detail: 'With the Poké Flute',
    dex: 143,
  },
  {
    id: 'hm02-fly',
    label: 'Get HM02 Fly',
    kind: 'key-item',
    part: all(11),
    locationId: 'route-16',
    detail: 'From a girl in a house behind a Cut tree',
    optional: true,
  },
  {
    id: 'good-rod',
    label: 'Get the Good Rod',
    kind: 'key-item',
    part: all(11),
    locationId: 'fuchsia-city',
    detail: "From the Fishing Guru's brother",
    grants: ['good-rod'],
    optional: true,
  },
  gym('Koga', 'Soul', 'TM06 Toxic', 'fuchsia-city', 11),
  {
    id: 'hm03-surf',
    label: 'Get HM03 Surf',
    kind: 'key-item',
    part: all(11),
    locationId: 'safari-zone',
    detail: 'From the Secret House in the Safari Zone',
    grants: ['surf'],
  },
  {
    id: 'hm04-strength',
    label: "Return the Warden's Gold Teeth",
    kind: 'key-item',
    part: all(11),
    locationId: 'fuchsia-city',
    detail: 'HM04 Strength; the Gold Teeth are in the Safari Zone',
    grants: ['strength'],
  },
  // Part 12
  {
    id: 'snorlax-route-12',
    label: 'Wake the Snorlax on Route 12',
    kind: 'encounter',
    part: all(12),
    locationId: 'route-12',
    detail: 'With the Poké Flute',
    dex: 143,
  },
  {
    id: 'super-rod',
    label: 'Get the Super Rod',
    kind: 'key-item',
    part: all(12),
    locationId: 'route-12',
    detail: "From the Fishing Guru's younger brother",
    grants: ['super-rod'],
    optional: true,
  },
  {
    id: 'articuno',
    label: 'Battle Articuno',
    kind: 'encounter',
    part: all(12),
    locationId: 'seafoam-islands',
    dex: 144,
    optional: true,
  },
  // Part 13
  {
    id: 'secret-key',
    label: 'Get the Secret Key',
    kind: 'key-item',
    part: all(13),
    locationId: 'pokemon-mansion',
    grants: ['secret-key'],
  },
  {
    id: 'revive-fossil',
    label: 'Revive the Helix or Dome Fossil',
    kind: 'gift',
    part: all(13),
    locationId: 'cinnabar-lab',
    detail: 'Omanyte or Kabuto',
    optional: true,
  },
  {
    id: 'revive-old-amber',
    label: 'Revive the Old Amber',
    kind: 'gift',
    part: all(13),
    locationId: 'cinnabar-lab',
    detail: 'Aerodactyl',
    dex: 142,
    optional: true,
  },
  gym('Blaine', 'Volcano', 'TM38 Fire Blast', 'cinnabar-island', 13),
  // Part 14
  {
    id: 'zapdos',
    label: 'Battle Zapdos',
    kind: 'encounter',
    part: all(14),
    locationId: 'power-plant',
    dex: 145,
    optional: true,
  },
  gym('Giovanni', 'Earth', 'TM27 Fissure', 'viridian-city', 14),
  // Part 15
  rival(7, 'route-22', 15, 'On Route 22, before Victory Road'),
  {
    id: 'moltres',
    label: 'Battle Moltres',
    kind: 'encounter',
    part: all(15),
    locationId: 'victory-road',
    dex: 146,
    optional: true,
  },
  // Part 16
  ...(['Lorelei', 'Bruno', 'Agatha', 'Lance'] as const).map((name): MilestoneDefinition => ({
    id: `elite-four-${name.toLowerCase()}`,
    label: `Defeat ${name}`,
    kind: 'battle',
    trainer: name,
    part: all(16),
    locationId: 'indigo-plateau',
    detail: 'Elite Four',
  })),
  {
    id: 'champion',
    label: 'Defeat the Champion',
    kind: 'battle',
    trainer: 'Blue',
    part: all(16),
    locationId: 'indigo-plateau',
    detail: 'Your rival; then enter the Hall of Fame',
    grants: ['post-game'],
  },
  // Part 17
  {
    id: 'mewtwo',
    label: 'Battle Mewtwo',
    kind: 'encounter',
    part: all(17),
    locationId: 'cerulean-cave',
    dex: 150,
    optional: true,
  },
];

/** Numbers of milestones that were removed or renamed; never reused (plan §7.14). */
export const RBY_RETIRED_MILESTONES: readonly RetiredMilestone[] = [];
