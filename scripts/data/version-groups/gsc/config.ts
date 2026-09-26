import { entry2Adapter } from '../../adapters/entry2';
import type { VersionGroupConfig } from '../types';
import { GSC_IGNORED_CATEGORY_PAGES, GSC_LOCATIONS } from './locations';
import { GSC_CATCH_RATE_NOTES } from './overrides/catch-rate-notes';
import { GSC_ENCOUNTER_OVERRIDES } from './overrides/encounters';
import { GSC_EVOLUTIONS } from './overrides/evolutions';
import { GSC_ITEM_OVERRIDES } from './overrides/items';
import { GSC_EGG_MOVE_PATCHES, GSC_MOVE_DATA } from './overrides/moves';
import { GSC_UNLOCKS } from './overrides/unlocks';
import { CRYSTAL_WALKTHROUGH, GS_WALKTHROUGH } from './walkthrough';

/**
 * Gold, Silver and Crystal (plan §16 Phase 10). The learnset columns and the item cross-check still arrive with
 * Stages D and E; until then the gsc build reports errors and writes nothing.
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
  // `{{learnlist/levelh/2|…|GS|C}}` columns and `GS`/`C` flags on prior-evolution rows.
  learnsetLevelColumns: { GS: ['gold', 'silver'], C: ['crystal'] },
  // `{{learnlist/tutor2|…}}`: the Move Tutor is in Crystal only.
  learnsetTutorColumns: [['crystal']],
  itemGameFlags: { G: ['gold'], S: ['silver'], C: ['crystal'] },
  itemAliases: {},
  // Both Generation II prize windows (Goldenrod's TM window is titled `[[TM]]s`, naming no game).
  prizeShops: [
    {
      locationId: 'goldenrod-game-corner',
      sectionPath: [/^Prize corner/i, 'Generation II'],
      requires: ['coin-case'],
      itemSubArea: 'Prize corner',
    },
    {
      locationId: 'celadon-game-corner',
      sectionPath: [/^Prize corner/i, 'Generation II'],
      requires: ['coin-case'],
      itemSubArea: 'Prize corner',
    },
  ],
  tradePage: {
    page: 'In-game trade',
    tables: [
      {
        heading: 'Pokémon Gold, Silver, and Crystal',
        games: ['gold', 'silver', 'crystal'],
        // Trades that differ per game span two rows, one colored for Gold and Silver, one for Crystal.
        cellColorGames: { gold: ['gold'], silver: ['silver'], crystal: ['crystal'] },
      },
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
    evolutions: GSC_EVOLUTIONS,
    catchRateNotes: GSC_CATCH_RATE_NOTES,
    unlocks: GSC_UNLOCKS,
    items: GSC_ITEM_OVERRIDES,
    encounters: GSC_ENCOUNTER_OVERRIDES,
    // The Day-Care couple live on Route 34; Ditto breeds with every species of an egg group but Ditto and No Eggs.
    breeding: { dayCareLocationIds: ['route-34'], dittoDex: 132 },
    moveData: GSC_MOVE_DATA,
    eggMovePatches: GSC_EGG_MOVE_PATCHES,
  },
};
