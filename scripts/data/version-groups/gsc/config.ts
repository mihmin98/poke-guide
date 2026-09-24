import { entry2Adapter } from '../../adapters/entry2';
import type { VersionGroupConfig } from '../types';
import { GSC_IGNORED_CATEGORY_PAGES, GSC_LOCATIONS } from './locations';
import { CRYSTAL_WALKTHROUGH, GS_WALKTHROUGH } from './walkthrough';

/**
 * Gold, Silver and Crystal (plan §16 Phase 10). The curated overrides, learnset columns and prize shops are still
 * empty: they arrive with Stages C–E, and until then the gsc build reports errors and writes nothing.
 */
export const gscConfig: VersionGroupConfig = {
  id: 'gsc',
  games: ['gold', 'silver', 'crystal'],
  generation: 2,
  generationHeading: 'Generation II',
  catchAdapters: [entry2Adapter],
  locationCategory: 'Category:Gold, Silver and Crystal locations',
  ignoredCategoryPages: GSC_IGNORED_CATEGORY_PAGES,
  locations: GSC_LOCATIONS,
  walkthroughs: { gold: GS_WALKTHROUGH, silver: GS_WALKTHROUGH, crystal: CRYSTAL_WALKTHROUGH },
  walkthroughPages: {
    gold: 'Walkthrough:Pokémon Gold and Silver',
    silver: 'Walkthrough:Pokémon Gold and Silver',
    crystal: 'Walkthrough:Pokémon Crystal',
  },
  speciesRange: [1, 251],
  learnsetLevelColumns: {},
  itemGameFlags: { G: ['gold'], S: ['silver'], C: ['crystal'] },
  itemAliases: {},
  tradePage: {
    page: 'In-game trade',
    tables: [
      { heading: 'Pokémon Gold, Silver, and Crystal', games: ['gold', 'silver', 'crystal'] },
    ],
  },
  regionalDexPage: 'List of Pokémon by New Pokédex number',
  // Gold and Silver: static 56×56 PNGs. Crystal's are animated PNGs, so only their first frame is kept.
  spriteSets: {
    'gen2-g': { filePattern: 'Spr_2g_{dex3}.png' },
    'gen2-s': { filePattern: 'Spr_2s_{dex3}.png' },
    'gen2-c': { filePattern: 'Spr_2c_{dex3}.png', stillFrame: true },
  },
  overrides: {
    evolutions: [],
    catchRateNotes: [],
    unlocks: {},
    items: { requirementPhrases: {}, add: [], requires: [], choiceGroups: [] },
    encounters: { encounters: [], patches: [], exclusiveGroups: [], eventOnly: [] },
  },
};
