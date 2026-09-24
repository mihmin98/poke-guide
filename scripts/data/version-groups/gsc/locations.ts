/**
 * Gold/Silver/Crystal locations in walkthrough order (plan §10, §16 Phase 10). Kanto places reuse rby's ids; Johto
 * route numbers (29–46) don't collide with Kanto's, so Johto routes are `route-29`…`route-46` too.
 *
 * The list follows Crystal's visit order; `placeLocations` numbers each game's locations within a part in list
 * order, so a location placed in a different part for Gold/Silver (Tin Tower) can sit at its Crystal position.
 *
 * Deviations from the walkthroughs, all "listed where first reachable" like rby's Route 22:
 * - Route 46 (Crystal's walkthrough: Part 13) is in Part 1, where Gold/Silver's walkthrough visits it.
 * - Dark Cave (Crystal: Part 13) is in Part 3, where Gold/Silver's walkthrough enters it from Route 31.
 * - Route 36 (Crystal: Part 7) is in Part 4, where Gold/Silver's walkthrough visits its east side from Violet City.
 */
import type { GameId, LocationKind, RegionId } from '../../../../src/app/core/domain/models';
import type { LocationConfig } from '../types';

const GAMES: readonly GameId[] = ['gold', 'silver', 'crystal'];

/** A location every game visits in the same part, unless `parts` gives one per game. */
function place(
  region: RegionId,
  id: string,
  page: string,
  name: string,
  kind: LocationKind,
  parts: number | Partial<Record<GameId, number>>,
  extra: Partial<LocationConfig> = {},
): LocationConfig {
  const perGame =
    typeof parts === 'number' ? Object.fromEntries(GAMES.map((g) => [g, parts])) : parts;
  const placement: LocationConfig['placement'] = {};
  for (const game of GAMES) {
    const part = perGame[game];
    if (part !== undefined) placement[game] = { part };
  }
  return { id, page, name, kind, region, placement, ...extra };
}

type PlaceArgs = Parameters<typeof place> extends [RegionId, ...infer Rest] ? Rest : never;
const johto = (...args: PlaceArgs) => place('johto', ...args);
const kanto = (...args: PlaceArgs) => place('kanto', ...args);

const johtoRoute = (n: number, part: number, kind: LocationKind = 'route') =>
  johto(`route-${n}`, `Johto Route ${n}`, `Route ${n}`, kind, part);
const kantoRoute = (n: number, part: number, kind: LocationKind = 'route') =>
  kanto(`route-${n}`, `Kanto Route ${n}`, `Route ${n}`, kind, part);

export const GSC_LOCATIONS: LocationConfig[] = [
  // Part 1
  johto('new-bark-town', 'New Bark Town', 'New Bark Town', 'town', 1),
  johtoRoute(29, 1),
  johtoRoute(46, 1),
  // Part 2
  johto('cherrygrove-city', 'Cherrygrove City', 'Cherrygrove City', 'town', 2),
  johtoRoute(30, 2),
  // Part 3
  johtoRoute(31, 3),
  johto('dark-cave', 'Dark Cave', 'Dark Cave', 'cave', 3),
  johto('violet-city', 'Violet City', 'Violet City', 'town', 3),
  johto('sprout-tower', 'Sprout Tower', 'Sprout Tower', 'building', 3),
  // Part 4
  johtoRoute(36, 4),
  johtoRoute(32, 4),
  johto('ruins-of-alph', 'Ruins of Alph', 'Ruins of Alph', 'special', 4),
  johto('union-cave', 'Union Cave', 'Union Cave', 'cave', 4),
  johtoRoute(33, 4),
  // Part 5
  johto('azalea-town', 'Azalea Town', 'Azalea Town', 'town', 5),
  johto('slowpoke-well', 'Slowpoke Well', 'Slowpoke Well', 'cave', 5),
  johto('ilex-forest', 'Ilex Forest', 'Ilex Forest', 'route', 5),
  johtoRoute(34, 5),
  // Part 6
  johto('goldenrod-city', 'Goldenrod City', 'Goldenrod City', 'town', 6),
  johto(
    'goldenrod-department-store',
    'Goldenrod Department Store',
    'Goldenrod Department Store',
    'building',
    6,
  ),
  johto('goldenrod-radio-tower', 'Goldenrod Radio Tower', 'Goldenrod Radio Tower', 'building', 6, {
    expectEmpty: true,
  }),
  johto('goldenrod-game-corner', 'Goldenrod Game Corner', 'Goldenrod Game Corner', 'building', 6, {
    expectEmpty: true,
  }),
  // "The Underground" in Generation II; Bulbapedia's page uses the Generation IV name.
  johto('goldenrod-underground', 'Goldenrod Tunnel', 'Goldenrod Underground', 'building', 6, {
    expectEmpty: true,
  }),
  // Part 7
  johtoRoute(35, 7),
  johto('national-park', 'National Park', 'National Park', 'special', 7),
  johtoRoute(37, 7),
  // Part 8
  johto('ecruteak-city', 'Ecruteak City', 'Ecruteak City', 'town', 8),
  johto('burned-tower', 'Burned Tower', 'Burned Tower', 'building', 8),
  johtoRoute(38, 8),
  johtoRoute(39, 8),
  johto('moomoo-farm', 'Moomoo Farm', 'Moomoo Farm', 'building', 8, { expectEmpty: true }),
  // Part 9
  johto('olivine-city', 'Olivine City', 'Olivine City', 'town', 9),
  johto('olivine-lighthouse', 'Olivine Lighthouse', 'Olivine Lighthouse', 'building', 9, {
    expectEmpty: true,
  }),
  johtoRoute(40, 9, 'water'),
  johto(
    'battle-tower',
    'Battle Tower (Generation II)',
    'Battle Tower',
    'building',
    { crystal: 9 },
    { expectEmpty: true },
  ),
  johtoRoute(41, 9, 'water'),
  johto('whirl-islands', 'Whirl Islands', 'Whirl Islands', 'cave', 9),
  // Part 10
  johto('cianwood-city', 'Cianwood City', 'Cianwood City', 'town', 10),
  johtoRoute(42, 10),
  johto('mt-mortar', 'Mt. Mortar', 'Mt. Mortar', 'cave', 10),
  // Part 11
  johto('mahogany-town', 'Mahogany Town', 'Mahogany Town', 'town', 11, { expectEmpty: true }),
  johtoRoute(43, 11),
  johto('lake-of-rage', 'Lake of Rage', 'Lake of Rage', 'route', 11),
  // "Team Rocket's Hideout" in Generation II; Bulbapedia's page uses the Generation IV name.
  johto('team-rocket-hq', 'Team Rocket HQ', "Team Rocket's Hideout", 'building', 11, {
    expectEmpty: true,
  }),
  // Part 12
  // Crystal's walkthrough enters Tin Tower (1F, Suicune) here; Gold and Silver enter it with the Rainbow Wing in
  // Part 29. Bulbapedia's page uses the Generation IV name, Bell Tower.
  johto('tin-tower', 'Bell Tower', 'Tin Tower', 'building', { gold: 29, silver: 29, crystal: 12 }),
  johtoRoute(44, 12),
  johto('ice-path', 'Ice Path', 'Ice Path', 'cave', 12),
  // Part 13
  johto('blackthorn-city', 'Blackthorn City', 'Blackthorn City', 'town', 13),
  johto('dragons-den', "Dragon's Den", "Dragon's Den", 'cave', 13),
  johtoRoute(45, 13),
  // Part 14 (Routes 26 and 27 and Tohjo Falls are in Kanto, reached from Johto)
  kantoRoute(27, 14),
  kanto('tohjo-falls', 'Tohjo Falls', 'Tohjo Falls', 'cave', 14),
  kantoRoute(26, 14),
  kanto('victory-road', 'Victory Road (Kanto)', 'Victory Road', 'cave', 14),
  // Part 16
  johto('ss-aqua', 'S.S. Aqua', 'S.S. Aqua', 'building', 16, { expectEmpty: true }),
  kanto('vermilion-city', 'Vermilion City', 'Vermilion City', 'town', 16),
  // Part 17
  kantoRoute(6, 17),
  kanto('saffron-city', 'Saffron City', 'Saffron City', 'town', 17, { expectEmpty: true }),
  kanto('silph-co', 'Silph Co.', 'Silph Co.', 'building', 17, { expectEmpty: true }),
  kanto('fighting-dojo', 'Fighting Dojo', 'Fighting Dojo', 'building', 17, { expectEmpty: true }),
  // Part 18
  kantoRoute(8, 18),
  kanto('lavender-town', 'Lavender Town', 'Lavender Town', 'town', 18, { expectEmpty: true }),
  // The Pokémon Tower was replaced by the Kanto Radio Tower in Generation II; the page covers both.
  kanto('kanto-radio-tower', 'Pokémon Tower', 'Kanto Radio Tower', 'building', 18, {
    expectEmpty: true,
  }),
  kantoRoute(10, 18),
  kanto('rock-tunnel', 'Rock Tunnel', 'Rock Tunnel', 'cave', 18),
  kantoRoute(9, 18),
  kanto('power-plant', 'Kanto Power Plant', 'Power Plant', 'building', 18),
  // Part 19
  kanto('cerulean-city', 'Cerulean City', 'Cerulean City', 'town', 19),
  kantoRoute(24, 19),
  kantoRoute(25, 19),
  kanto('sea-cottage', 'Sea Cottage', 'Sea Cottage', 'building', 19, { expectEmpty: true }),
  kantoRoute(5, 19),
  kanto(
    'underground-path-5-6',
    'Underground Path (Kanto Routes 5–6)',
    'Underground Path (Routes 5–6)',
    'building',
    19,
    { expectEmpty: true },
  ),
  // Part 20
  kantoRoute(7, 20),
  kanto('celadon-city', 'Celadon City', 'Celadon City', 'town', 20),
  kanto('celadon-condominiums', 'Celadon Condominiums', 'Celadon Condominiums', 'building', 20, {
    expectEmpty: true,
  }),
  kanto('celadon-game-corner', 'Celadon Game Corner', 'Celadon Game Corner', 'building', 20, {
    expectEmpty: true,
  }),
  // Part 21
  kantoRoute(16, 21),
  kantoRoute(17, 21),
  kantoRoute(18, 21),
  kanto('fuchsia-city', 'Fuchsia City', 'Fuchsia City', 'town', 21),
  // Part 22
  kantoRoute(15, 22),
  kantoRoute(14, 22),
  kantoRoute(13, 22),
  kantoRoute(12, 22),
  // Part 23
  kantoRoute(11, 23),
  kanto('digletts-cave', "Diglett's Cave", "Diglett's Cave", 'cave', 23),
  kantoRoute(2, 23),
  kanto('pewter-city', 'Pewter City', 'Pewter City', 'town', 23),
  // Part 24
  kantoRoute(3, 24),
  kanto('mt-moon', 'Mt. Moon', 'Mt. Moon', 'cave', 24),
  kanto('mt-moon-square', 'Mt. Moon Square', 'Mt. Moon Square', 'special', 24, {
    expectEmpty: true,
  }),
  kantoRoute(4, 24),
  // Part 25
  kanto('viridian-city', 'Viridian City', 'Viridian City', 'town', 25),
  kantoRoute(1, 25),
  kanto('pallet-town', 'Pallet Town', 'Pallet Town', 'town', 25),
  // Part 26
  kantoRoute(21, 26, 'water'),
  kanto('cinnabar-island', 'Cinnabar Island', 'Cinnabar Island', 'town', 26),
  kantoRoute(20, 26, 'water'),
  kantoRoute(19, 26, 'water'),
  // Part 27
  kantoRoute(22, 27),
  kantoRoute(28, 27),
  // Bulbapedia puts Mt. Silver in Johto; Generation II names both areas "Silver Cave".
  johto('mt-silver', 'Mt. Silver', 'Mt. Silver', 'special', 27),
  // Part 28
  johto('mt-silver-cave', 'Mt. Silver Cave', 'Mt. Silver Cave', 'cave', 28),
];

/**
 * Members of `Category:Gold, Silver and Crystal locations` that intentionally have no entry. Besides the general
 * pages, these have nothing to catch or pick up in Gold, Silver or Crystal: no Generation II encounters and no
 * item rows for these games.
 */
export const GSC_IGNORED_CATEGORY_PAGES: string[] = [
  'Johto',
  'Kanto',
  'Hometown',
  "Player's house",
  'Poké Mart',
  'Pokémon Center',
  // Breeding is `overrides.breeding` (the Route 34 Day Care).
  'Pokémon Day Care',
  'Pokémon League Reception Gate',
  'Category:Johto Gyms',
  'Category:Kanto Gyms',
  // Only shops in Generation II.
  'Celadon Department Store',
  // A user-space draft page in the category.
  'User:Lewtwo/NewLocation',
  // The HeartGold/SoulSilver path to the Bell Tower; its items are Generation IV only.
  'Bellchime Trail',
  // Lavender Town's Soul House: an NPC house.
  'House of Memories',
  'Indigo Plateau',
  'Kanto Route 23',
  'Magnet Train',
  "Professor Oak's Laboratory",
  // Only Blaine's temporary Gym is accessible.
  'Seafoam Islands',
  'Trainer House',
  // Not reachable in Generation II.
  'Viridian Forest',
];
