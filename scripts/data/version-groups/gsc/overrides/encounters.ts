/**
 * Gold/Silver/Crystal encounter overrides (plan §7.7, §16 Phase 10). Statics are in the location pages' "Special
 * encounters" sections, not their tables; each level is checked against pret's pokegold (Gold/Silver) and
 * pokecrystal map scripts (`loadwildmon`), which agree with the pages for every entry here.
 */
import type { GameId } from '../../../../../src/app/core/domain/models';
import type { EncounterOverrides, OverrideEncounter } from '../../../core/encounter-overrides';

const ALL: GameId[] = ['gold', 'silver', 'crystal'];
const GS: GameId[] = ['gold', 'silver'];
const pretGold = (path: string) => `https://github.com/pret/pokegold/blob/master/${path}`;
const pretCrystal = (path: string) => `https://github.com/pret/pokecrystal/blob/master/${path}`;
/** The same script in both disassemblies. */
const pretBoth = (path: string) => `${pretGold(path)} and ${pretCrystal(path)}`;

/** One static per level: Lugia and Ho-Oh are level 40 in their own version and 70 in the other, 60 in Crystal. */
function legendary(
  base: Omit<OverrideEncounter, 'games' | 'level' | 'reason'>,
  levels: [GameId[], number][],
  path: string,
): OverrideEncounter[] {
  return levels.map(([games, level]) => ({
    ...base,
    games,
    level,
    reason: `Special encounter; levels from ${pretBoth(path)}`,
  }));
}

/** The Team Rocket HQ trap floor and generator room: each can only be battled once. */
function rocketHq(dex: number, name: string, level: number, subArea: string, path: string) {
  return {
    locationId: 'team-rocket-hq',
    dex,
    name,
    method: 'static',
    games: ALL,
    level,
    subArea,
    note: 'On the trap floor; can only be battled once',
    reason: `Special encounter; level from ${pretBoth(path)}`,
  } satisfies OverrideEncounter;
}

/** Raikou, Entei and (Gold/Silver) Suicune flee the Burned Tower's basement and roam Johto at level 40. */
function roamer(dex: number, name: string, games: GameId[]): OverrideEncounter {
  return {
    locationId: 'burned-tower',
    dex,
    name,
    method: 'roaming',
    games,
    level: 40,
    subArea: 'B1F',
    note: 'Flees the Burned Tower, then roams the grass of Johto',
    reason: `Roaming; level from InitRoamMons in ${pretBoth('engine/overworld/wildmons.asm')}`,
  };
}

export const GSC_ENCOUNTER_OVERRIDES: EncounterOverrides = {
  encounters: [
    {
      locationId: 'route-36',
      dex: 185,
      name: 'Sudowoodo',
      method: 'static',
      games: ALL,
      level: 20,
      requires: ['squirtbottle'],
      note: 'Blocks the path; water it with the SquirtBottle',
      reason: `Special encounter; level from ${pretBoth('maps/Route36.asm')}`,
    },
    {
      locationId: 'union-cave',
      dex: 131,
      name: 'Lapras',
      method: 'static',
      games: ALL,
      level: 20,
      subArea: 'B2F',
      requires: ['surf'],
      conditions: [{ kind: 'day-of-week', value: 'fri' }],
      note: 'Appears every Friday',
      reason: `Special encounter; level from ${pretBoth('maps/UnionCaveB2F.asm')}`,
    },
    {
      locationId: 'lake-of-rage',
      dex: 130,
      name: 'Gyarados',
      method: 'static',
      games: ALL,
      level: 30,
      requires: ['surf'],
      label: 'Red Gyarados',
      note: 'Always Shiny, with fixed DVs; drops the Red Scale',
      // BATTLETYPE_FORCESHINY gives ATKDEFDV_SHINY $EA and SPDSPCDV_SHINY $AA (constants/battle_constants.asm).
      ivs: { hp: 0, atk: 14, def: 10, spe: 10, spc: 10 },
      shiny: 'guaranteed',
      reason: `Special encounter; level, DVs and shininess from ${pretBoth('maps/LakeOfRage.asm')}`,
    },
    rocketHq(100, 'Voltorb', 23, 'B1F', 'maps/TeamRocketBaseB1F.asm'),
    rocketHq(74, 'Geodude', 21, 'B1F', 'maps/TeamRocketBaseB1F.asm'),
    rocketHq(109, 'Koffing', 21, 'B1F', 'maps/TeamRocketBaseB1F.asm'),
    {
      ...rocketHq(101, 'Electrode', 23, 'B2F', 'maps/TeamRocketBaseB2F.asm'),
      note: 'Three, powering the radio transmitter',
    },
    ...legendary(
      {
        locationId: 'whirl-islands',
        dex: 249,
        name: 'Lugia',
        method: 'static',
        subArea: 'B2F',
        requires: ['silver-wing'],
      },
      [
        [['silver'], 40],
        [['gold'], 70],
        [['crystal'], 60],
      ],
      'maps/WhirlIslandLugiaChamber.asm',
    ),
    ...legendary(
      {
        locationId: 'tin-tower',
        dex: 250,
        name: 'Ho-Oh',
        method: 'static',
        subArea: 'Roof',
        requires: ['rainbow-wing'],
      },
      [
        [['gold'], 40],
        [['silver'], 70],
        [['crystal'], 60],
      ],
      'maps/TinTowerRoof.asm',
    ),
    {
      locationId: 'tin-tower',
      dex: 245,
      name: 'Suicune',
      method: 'static',
      games: ['crystal'],
      level: 40,
      subArea: '1F',
      requires: ['clear-bell'],
      note: 'After defeating Eusine at the Tin Tower',
      reason: `Special encounter; level from ${pretCrystal('maps/TinTower1F.asm')}`,
    },
    {
      locationId: 'vermilion-city',
      dex: 143,
      name: 'Snorlax',
      method: 'static',
      games: ALL,
      level: 50,
      requires: ['expn-card'],
      note: "Sleeping by Diglett's Cave; wake it with the radio's Poké Flute channel",
      reason: `Special encounter; level from ${pretBoth('maps/VermilionCity.asm')}`,
    },
    roamer(243, 'Raikou', ALL),
    roamer(244, 'Entei', ALL),
    roamer(245, 'Suicune', GS),
  ],
  patches: [
    {
      locationId: 'new-bark-town',
      match: { method: 'gift', label: 'First partner Pokémon' },
      set: { method: 'starter', label: null },
      reason: 'The "First partner Pokémon" group is the starter choice in Professor Elm\'s Lab',
    },
    {
      locationId: 'violet-city',
      match: { method: 'egg', dex: 175 },
      set: { label: "From Professor Elm's assistant, after the Zephyr Badge" },
      reason: 'Shortens the "Gift Pokémon" group heading, which holds the whole explanation',
    },
    {
      locationId: 'goldenrod-city',
      match: { method: 'gift', dex: 133 },
      set: { label: 'From Bill, after meeting him in Ecruteak City' },
      reason: 'Shortens the "Gift Pokémon" group heading, which holds the whole explanation',
    },
    {
      locationId: 'route-34',
      match: { method: 'egg' },
      set: { label: 'Odd Egg' },
      reason: 'Shortens the "Odd Egg" group heading, which holds the whole explanation',
    },
    {
      locationId: 'dragons-den',
      match: { method: 'gift', dex: 147 },
      set: { requires: ['surf', 'whirlpool'] },
      reason:
        "The elder gives Dratini after his test in the Dragon Shrine, which needs Surf and Whirlpool (Walkthrough:Pokémon Crystal/Part 13: Clair's TM24 after the test is marked the same way)",
    },
    {
      locationId: 'route-24',
      match: { method: 'walk-grass', dex: 48, games: ['crystal'] },
      set: { levels: { min: 10, max: 10 } },
      reason: `Bulbapedia (revid 4618421) gives Crystal's night Venonat level 8, Gold and Silver's level; Crystal's slot is level 10 in ${pretCrystal('data/wild/kanto_grass.asm')} (found by the Phase 10 spot check)`,
    },
  ],
  exclusiveGroups: [
    {
      id: 'gsc-starter',
      label: 'Starter choice',
      games: ALL,
      members: [152, 155, 158],
      locationIds: ['new-bark-town'],
      methods: ['starter'],
    },
    {
      id: 'odd-egg',
      label: 'Odd Egg (random)',
      games: ['crystal'],
      members: [172, 173, 174, 236, 238, 239, 240],
      locationIds: ['route-34'],
      methods: ['egg'],
    },
  ],
  // Mew and Celebi (the GS Ball event of the original Japanese Crystal) were only distributed at events.
  eventOnly: [151, 251],
  requiresOtherGame: [
    {
      // Checked against every Generation II location table: no source in Gold, Silver or Crystal.
      dex: [1, 2, 3, 4, 5, 6, 7, 8, 9, 138, 139, 140, 141, 144, 145, 146, 150],
      detail: 'Transfer from Red, Blue or Yellow through the Time Capsule',
    },
  ],
};
