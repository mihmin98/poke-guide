/** Pages captured into `__fixtures__/` for parser tests (plan §14). Refresh with `npm run data:fixtures -- --group gsc`. */
import type { FixturePage } from '../rby/fixture-pages';

export const GSC_FIXTURE_PAGES: readonly FixturePage[] = [
  // Encounters: time-of-day rates, floors and sub-areas, and the Gen II methods
  { name: 'route-29', title: 'Johto Route 29' },
  { name: 'route-32', title: 'Johto Route 32' },
  { name: 'route-34', title: 'Johto Route 34' },
  { name: 'union-cave', title: 'Union Cave' },
  { name: 'dark-cave', title: 'Dark Cave' },
  { name: 'ilex-forest', title: 'Ilex Forest' },
  { name: 'ruins-of-alph', title: 'Ruins of Alph' },
  { name: 'national-park', title: 'National Park' },
  { name: 'lake-of-rage', title: 'Lake of Rage' },
  { name: 'whirl-islands', title: 'Whirl Islands' },
  { name: 'mt-mortar', title: 'Mt. Mortar' },
  { name: 'tin-tower', title: 'Bell Tower' },
  { name: 'mt-silver-cave', title: 'Mt. Silver Cave' },
  { name: 'route-26', title: 'Kanto Route 26' },
  { name: 'cerulean-city', title: 'Cerulean City' },
  { name: 'goldenrod-department-store', title: 'Goldenrod Department Store' },
  { name: 'goldenrod-game-corner', title: 'Goldenrod Game Corner' },
  { name: 'celadon-game-corner', title: 'Celadon Game Corner' },
  { name: 'in-game-trade', title: 'In-game trade' },
  // Items (plan §7.13)
  { name: 'goldenrod-underground', title: 'Goldenrod Tunnel' },
  { name: 'battle-tower', title: 'Battle Tower (Generation II)' },
  { name: 'walkthrough-gs-part-5', title: 'Walkthrough:Pokémon Gold and Silver/Part 5' },
  { name: 'walkthrough-c-part-12', title: 'Walkthrough:Pokémon Crystal/Part 12' },
  // Species data
  { name: 'new-pokedex-list', title: 'List of Pokémon by New Pokédex number' },
];
