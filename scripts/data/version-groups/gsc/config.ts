import type { LocationItem } from '../../../../src/app/core/domain/models';
import { entry2Adapter } from '../../adapters/entry2';
import type { ItemNoteRule, VersionGroupConfig } from '../types';
import { GSC_IGNORED_CATEGORY_PAGES, GSC_LOCATIONS } from './locations';
import { GSC_CATCH_RATE_NOTES } from './overrides/catch-rate-notes';
import { GSC_ENCOUNTER_OVERRIDES } from './overrides/encounters';
import { GSC_EVOLUTIONS } from './overrides/evolutions';
import { GSC_ITEM_OVERRIDES } from './overrides/items';
import { GSC_MILESTONES, GSC_RETIRED_MILESTONES } from './overrides/milestones';
import { GSC_EGG_MOVE_PATCHES, GSC_MOVE_DATA } from './overrides/moves';
import { GSC_UNLOCKS } from './overrides/unlocks';
import { CRYSTAL_WALKTHROUGH, GS_WALKTHROUGH } from './walkthrough';

const noteRule = (
  match: RegExp,
  label: string,
  where: (item: LocationItem) => string = (item) => item.where,
): ItemNoteRule => ({
  match,
  note: (item) => `${label}: ${item.name} — ${where(item)}`,
});

/**
 * Recurring item sources are location notes, not tickable items (plan §16 Phase 10): they give the item again and
 * again, like Poké Mart stock.
 */
const GSC_ITEM_NOTE_RULES: ItemNoteRule[] = [
  // Berry and Apricorn trees; walkthroughs write "(daily; requires Surf, Cut)".
  noteRule(/\(daily\b/, 'Daily tree', (item) => item.where.replace(/\s*\(daily\)/, '')),
  // Crystal's phone-call gifts, given again at random; Bug Catcher Wade's rows sit under his name.
  noteRule(/^Sometimes given\b/, 'Phone gift', (item) =>
    item.subArea && !item.where.includes(item.subArea.replace(/^\S+ /, ''))
      ? item.where.replace(/^Sometimes given( out)?/, `Sometimes given$1 by ${item.subArea}`)
      : item.where,
  ),
  noteRule(
    /\bgiven out sometimes\b|Black ?belt Kenji,? after calling him|\(occasionally\)$/i,
    'Phone gift',
  ),
  // The Radio Tower's weekly ID lottery.
  noteRule(/^Pokémon ID matched\b/, 'Lottery prize'),
  // Moomoo Milk at the farm and Mahogany Town's RageCandyBar salesman.
  noteRule(/^(?:Buyable|Sold)\b|\bmay be purchased\b/i, 'For sale'),
];

/**
 * Gold, Silver and Crystal (plan §16 Phase 10).
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
  // Walkthroughs use later spellings; the location pages use the Generation II names.
  itemAliases: {
    'Black Belt': 'BlackBelt',
    Elixir: 'Elixer',
    'Max Elixir': 'Max Elixer',
    'X Defense': 'X Defend',
    Map: 'Map Card',
    Radio: 'Radio Card',
  },
  itemNoteRules: GSC_ITEM_NOTE_RULES,
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
        // Every Gen II trade has fixed DVs, matching pret `data/events/npc_trades.asm` in pokegold and pokecrystal.
        dvOrder: ['hp', 'atk', 'def', 'spe', 'spc'],
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
    milestones: { milestones: GSC_MILESTONES, retired: GSC_RETIRED_MILESTONES },
    // The Day-Care couple live on Route 34; Ditto breeds with every species of an egg group but Ditto and No Eggs.
    breeding: { dayCareLocationIds: ['route-34'], dittoDex: 132 },
    moveData: GSC_MOVE_DATA,
    eggMovePatches: GSC_EGG_MOVE_PATCHES,
  },
};
