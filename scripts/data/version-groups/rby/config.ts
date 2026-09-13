import { entry1Adapter } from '../../adapters/entry1';
import type { VersionGroupConfig } from '../types';
import { RBY_IGNORED_CATEGORY_PAGES, RBY_LOCATIONS } from './locations';
import { RBY_CATCH_RATE_NOTES } from './overrides/catch-rate-notes';
import { RBY_EVOLUTIONS } from './overrides/evolutions';
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
  overrides: { evolutions: RBY_EVOLUTIONS, catchRateNotes: RBY_CATCH_RATE_NOTES },
};
