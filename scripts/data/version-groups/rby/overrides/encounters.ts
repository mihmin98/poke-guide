/**
 * Red/Blue/Yellow encounter overrides (plan §7.7). Statics aren't in the location pages' Gen I tables; their
 * levels are checked against the pret disassemblies (pokered, pokeyellow), which agree for every entry here.
 */
import type { GameId } from '../../../../../src/app/core/domain/models';
import type { EncounterOverrides } from '../../../core/encounter-overrides';

const ALL: GameId[] = ['red', 'blue', 'yellow'];
const pret = (path: string) => `https://github.com/pret/pokered/blob/master/${path}`;

export const RBY_ENCOUNTER_OVERRIDES: EncounterOverrides = {
  encounters: [
    ...[12, 16].map((route) => ({
      locationId: `route-${route}`,
      dex: 143,
      name: 'Snorlax',
      method: 'static',
      games: ALL,
      level: 30,
      requires: ['poke-flute'],
      note: 'Sleeping on the path; wake it with the Poké Flute',
      reason: `Prose only; level from ${pret(`scripts/Route${route}.asm`)}`,
    })),
    {
      locationId: 'seafoam-islands',
      dex: 144,
      name: 'Articuno',
      method: 'static',
      games: ALL,
      level: 50,
      subArea: 'B4F',
      requires: ['surf', 'strength'],
      reason: `Prose only; level from ${pret('data/maps/objects/SeafoamIslandsB4F.asm')}`,
    },
    {
      locationId: 'power-plant',
      dex: 145,
      name: 'Zapdos',
      method: 'static',
      games: ALL,
      level: 50,
      requires: ['surf'],
      reason: `Prose only; level from ${pret('data/maps/objects/PowerPlant.asm')}`,
    },
    {
      locationId: 'power-plant',
      dex: 100,
      name: 'Voltorb',
      method: 'static',
      games: ALL,
      level: 40,
      requires: ['surf'],
      note: 'Six, disguised as item balls',
      reason: `Listed as fake items; ${pret('data/maps/objects/PowerPlant.asm')}`,
    },
    {
      locationId: 'power-plant',
      dex: 101,
      name: 'Electrode',
      method: 'static',
      games: ALL,
      level: 43,
      requires: ['surf'],
      note: 'Two, disguised as item balls',
      reason: `Listed as fake items; ${pret('data/maps/objects/PowerPlant.asm')}`,
    },
    {
      locationId: 'victory-road',
      dex: 146,
      name: 'Moltres',
      method: 'static',
      games: ALL,
      level: 50,
      subArea: '2F',
      requires: ['strength'],
      reason: `Prose only; level from ${pret('data/maps/objects/VictoryRoad2F.asm')}`,
    },
    {
      locationId: 'cerulean-cave',
      dex: 150,
      name: 'Mewtwo',
      method: 'static',
      games: ALL,
      level: 70,
      subArea: 'B1F',
      requires: ['post-game'],
      reason: `Prose only; level from ${pret('data/maps/objects/CeruleanCaveB1F.asm')}`,
    },
  ],
  patches: [
    {
      locationId: 'oaks-lab',
      match: { method: 'gift', label: 'First partner Pokémon' },
      set: { method: 'starter', label: null },
      reason: 'The "First partner Pokémon" group is the starter choice (Red/Blue) or Pikachu (Yellow)',
    },
    {
      locationId: 'route-1',
      match: { method: 'special', dex: 25, label: 'Attacking Oak' },
      set: 'drop',
      reason: "Yellow's Pikachu is the Oak's Lab starter; the Route 1 row describes the same Pikachu (open question 10)",
    },
  ],
  exclusiveGroups: [
    {
      id: 'rby-starter',
      label: 'Starter choice',
      games: ['red', 'blue'],
      members: [1, 4, 7],
      locationIds: ['oaks-lab'],
      methods: ['starter'],
    },
    {
      id: 'mt-moon-fossil',
      label: 'Mt. Moon fossil choice',
      games: ALL,
      members: [138, 140],
      locationIds: ['cinnabar-lab'],
      methods: ['fossil'],
    },
    {
      id: 'fighting-dojo',
      label: 'Fighting Dojo prize',
      games: ALL,
      members: [106, 107],
      locationIds: ['fighting-dojo'],
      methods: ['gift'],
    },
  ],
  eventOnly: [151],
};
