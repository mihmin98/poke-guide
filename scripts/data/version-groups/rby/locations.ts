/**
 * Red/Blue/Yellow locations in walkthrough order (plan §10). The three games share their parts.
 * Deviation from the walkthrough: Route 22 is listed in Part 2, where it is first reachable (it's in Part 15 there).
 */
import type { LocationKind } from '../../../../src/app/core/domain/models';
import type { LocationConfig } from '../types';

function kanto(id: string, page: string, name: string, kind: LocationKind, part: number, extra: Partial<LocationConfig> = {}): LocationConfig {
  return {
    id,
    page,
    name,
    kind,
    region: 'kanto',
    placement: { red: { part }, blue: { part }, yellow: { part } },
    ...extra,
  };
}

const route = (n: number, part: number, kind: LocationKind = 'route') =>
  kanto(`route-${n}`, `Kanto Route ${n}`, `Route ${n}`, kind, part);

export const RBY_LOCATIONS: LocationConfig[] = [
  // Part 1
  kanto('pallet-town', 'Pallet Town', 'Pallet Town', 'town', 1),
  // The starters are in the lab's Gen I table, not Pallet Town's.
  kanto('oaks-lab', "Professor Oak's Laboratory", "Professor Oak's Lab", 'building', 1),
  // Part 2
  route(1, 2),
  kanto('viridian-city', 'Viridian City', 'Viridian City', 'town', 2),
  route(22, 2),
  route(2, 2),
  // Part 3
  kanto('viridian-forest', 'Viridian Forest', 'Viridian Forest', 'route', 3),
  kanto('pewter-city', 'Pewter City', 'Pewter City', 'town', 3),
  // Part 4
  route(3, 4),
  kanto('mt-moon', 'Mt. Moon', 'Mt. Moon', 'cave', 4),
  route(4, 4),
  // Part 5
  kanto('cerulean-city', 'Cerulean City', 'Cerulean City', 'town', 5),
  route(24, 5),
  route(25, 5),
  kanto('sea-cottage', 'Sea Cottage', 'Sea Cottage', 'building', 5, { itemsOnly: true }),
  route(5, 5),
  kanto('underground-path-5-6', 'Underground Path (Kanto Routes 5–6)', 'Underground Path (Routes 5–6)', 'building', 5),
  // Part 6
  route(6, 6),
  kanto('vermilion-city', 'Vermilion City', 'Vermilion City', 'town', 6),
  kanto('ss-anne', 'S.S. Anne', 'S.S. Anne', 'building', 6),
  // Part 7
  route(11, 7),
  kanto('digletts-cave', "Diglett's Cave", "Diglett's Cave", 'cave', 7),
  kanto('pewter-museum', 'Pewter Museum of Science', 'Pewter Museum of Science', 'building', 7),
  route(9, 7),
  route(10, 7),
  // Part 8
  kanto('rock-tunnel', 'Rock Tunnel', 'Rock Tunnel', 'cave', 8),
  kanto('lavender-town', 'Lavender Town', 'Lavender Town', 'town', 8),
  route(8, 8),
  kanto('underground-path-7-8', 'Underground Path (Kanto Routes 7–8)', 'Underground Path (Routes 7–8)', 'building', 8),
  route(7, 8),
  // Part 9
  kanto('celadon-city', 'Celadon City', 'Celadon City', 'town', 9),
  kanto('celadon-department-store', 'Celadon Department Store', 'Celadon Department Store', 'building', 9, {
    itemsOnly: true,
  }),
  kanto('celadon-condominiums', 'Celadon Condominiums', 'Celadon Condominiums', 'building', 9),
  kanto('celadon-game-corner', 'Celadon Game Corner', 'Celadon Game Corner', 'building', 9),
  kanto('team-rocket-hideout', 'Team Rocket Hideout', 'Team Rocket Hideout', 'building', 9),
  kanto('pokemon-tower', 'Pokémon Tower', 'Pokémon Tower', 'building', 9),
  // Part 10
  kanto('saffron-city', 'Saffron City', 'Saffron City', 'town', 10),
  kanto('fighting-dojo', 'Fighting Dojo', 'Fighting Dojo', 'building', 10),
  kanto('silph-co', 'Silph Co.', 'Silph Co.', 'building', 10),
  // Part 11
  route(16, 11),
  route(17, 11),
  route(18, 11),
  kanto('fuchsia-city', 'Fuchsia City', 'Fuchsia City', 'town', 11),
  kanto('safari-zone', 'Kanto Safari Zone', 'Safari Zone', 'special', 11),
  // Part 12
  route(12, 12),
  route(13, 12),
  route(14, 12),
  route(15, 12),
  route(19, 12, 'water'),
  route(20, 12, 'water'),
  kanto('seafoam-islands', 'Seafoam Islands', 'Seafoam Islands', 'cave', 12),
  // Part 13
  kanto('cinnabar-island', 'Cinnabar Island', 'Cinnabar Island', 'town', 13),
  kanto('cinnabar-lab', 'Cinnabar Lab', 'Cinnabar Lab', 'building', 13),
  kanto('pokemon-mansion', 'Pokémon Mansion (Kanto)', 'Pokémon Mansion', 'building', 13),
  route(21, 13, 'water'),
  // Part 14
  kanto('power-plant', 'Kanto Power Plant', 'Power Plant', 'building', 14),
  // Part 15
  route(23, 15),
  kanto('victory-road', 'Victory Road (Kanto)', 'Victory Road', 'cave', 15),
  // Part 16
  // Not empty: Bulbapedia's Gen I table lists Old/Good Rod encounters in Lorelei's room.
  kanto('indigo-plateau', 'Indigo Plateau', 'Indigo Plateau', 'building', 16),
  // Part 17
  kanto('cerulean-cave', 'Cerulean Cave', 'Cerulean Cave', 'cave', 17),
];

/** Members of `Category:Red, Blue and Yellow locations` that intentionally have no entry (plan §10). */
export const RBY_IGNORED_CATEGORY_PAGES: string[] = [
  'Kanto',
  'Hometown',
  "Player's house",
  'Poké Mart',
  'Pokémon Center',
  'Pokémon Day Care',
  'Pokémon League Reception Gate',
  // Gym leader TMs are item overrides on their city (plan §7.13).
  'Category:Kanto Gyms',
];
