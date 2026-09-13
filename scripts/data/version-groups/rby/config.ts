import { entry1Adapter } from '../../adapters/entry1';
import type { VersionGroupConfig } from '../types';
import { RBY_IGNORED_CATEGORY_PAGES, RBY_LOCATIONS } from './locations';
import { RBY_CATCH_RATE_NOTES } from './overrides/catch-rate-notes';
import { RBY_EVOLUTIONS } from './overrides/evolutions';
import { RBY_ITEM_OVERRIDES } from './overrides/items';
import { RBY_UNLOCKS } from './overrides/unlocks';
import { RBY_WALKTHROUGH } from './walkthrough';

export const rbyConfig: VersionGroupConfig = {
  id: 'rby',
  games: ['red', 'blue', 'yellow'],
  generation: 1,
  generationHeading: 'Generation I',
  catchAdapters: [entry1Adapter],
  locationCategory: 'Category:Red, Blue and Yellow locations',
  ignoredCategoryPages: RBY_IGNORED_CATEGORY_PAGES,
  locations: RBY_LOCATIONS,
  walkthroughs: { red: RBY_WALKTHROUGH, blue: RBY_WALKTHROUGH, yellow: RBY_WALKTHROUGH },
  walkthroughPages: {
    red: 'Walkthrough:Pokémon Red and Blue',
    blue: 'Walkthrough:Pokémon Red and Blue',
    yellow: 'Walkthrough:Pokémon Yellow',
  },
  speciesRange: [1, 151],
  // "RGB" is Red/Green/Blue: the Japanese Green column covers the international Red and Blue.
  learnsetLevelColumns: { RGB: ['red', 'blue'], RB: ['red', 'blue'], Y: ['yellow'] },
  itemGameFlags: { R: ['red'], B: ['blue'], Y: ['yellow'] },
  itemAliases: { Elixer: 'Elixir', 'Max Elixer': 'Max Elixir' },
  prizeShops: [{ locationId: 'celadon-game-corner', sectionPath: [/^Prize corner/i, 'Generation I'], requires: ['coin-case'] }],
  tradePage: {
    page: 'In-game trade',
    tables: [
      { heading: 'Pokémon Red and Green (Japan), Pokémon Red and Blue (Western)', games: ['red', 'blue'] },
      { heading: 'Pokémon Yellow', games: ['yellow'] },
    ],
  },
  overrides: {
    evolutions: RBY_EVOLUTIONS,
    catchRateNotes: RBY_CATCH_RATE_NOTES,
    unlocks: { red: RBY_UNLOCKS, blue: RBY_UNLOCKS, yellow: RBY_UNLOCKS },
    items: RBY_ITEM_OVERRIDES,
  },
};
