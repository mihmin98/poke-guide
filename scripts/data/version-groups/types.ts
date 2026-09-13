/**
 * Version-group pipeline configuration (plan §7.1). Fields are added as the pipeline grows
 * (overrides, extra parsers, sprites).
 */
import type {
  EvolutionEdge,
  GameId,
  LocationKind,
  RegionId,
  Unlock,
  VersionGroupId,
  WalkthroughPart,
} from '../../../src/app/core/domain/models';
import type { CatchTemplateAdapter } from '../adapters/catch-template-adapter';
import type { CatchRateNoteClassification } from '../core/catch-rate-history';
import type { EncounterOverrides } from '../core/encounter-overrides';
import type { ItemOverrides } from '../core/location-items';
import type { TitleMatcher } from '../core/sections';
import type { TradePageConfig } from '../core/trades';

export interface LocationConfig {
  /** Region-scoped, stable id (`route-1` is Kanto Route 1). Reused by later games visiting the same place. */
  id: string;
  /** Bulbapedia page title. */
  page: string;
  /** Display name. */
  name: string;
  kind: LocationKind;
  region: RegionId;
  /** Walkthrough part per game; a game without an entry doesn't visit the location. */
  placement: Partial<Record<GameId, { part: number }>>;
  /** The page has no encounters for this generation; any row found is an error. */
  expectEmpty?: boolean;
  /** Listed for its items only (plan §7.13): the encounter section is not walked. */
  itemsOnly?: boolean;
}

export interface VersionGroupConfig {
  id: VersionGroupId;
  games: GameId[];
  generation: number;
  /** Heading of this generation's section on location pages, e.g. `Generation I`. */
  generationHeading: string;
  catchAdapters: CatchTemplateAdapter[];
  /** Category used to check that no location page is missing from `locations`. */
  locationCategory: string;
  /** Category members that intentionally have no location entry. */
  ignoredCategoryPages: string[];
  /** Ordered: within a part, list order is visit order. */
  locations: LocationConfig[];
  walkthroughs: Partial<Record<GameId, WalkthroughPart[]>>;
  walkthroughPages: Partial<Record<GameId, string>>;
  speciesRange: [number, number];
  /** Level column labels (`{{learnlist/levelh/1|…|RGB|Y}}`) and row game flags (`RB`) on learnset subpages → games. */
  learnsetLevelColumns: Record<string, GameId[]>;
  /** Game flag keys on `{{Itemlist}}` rows (`R=yes`) → games (plan §7.13). */
  itemGameFlags: Record<string, GameId[]>;
  /** Item spelling variants → the name used in the data (`Elixer` → `Elixir`). */
  itemAliases: Record<string, string>;
  /** Prize shops on location pages (plan §7.7); their rows become `prize` encounters at that location. */
  prizeShops?: { locationId: string; sectionPath: TitleMatcher[]; requires: string[] }[];
  /** In-game trade tables, diffed against the location tables' trade rows (plan §7.7). */
  tradePage?: TradePageConfig;
  overrides: {
    /** Authoritative evolution graph; parsed evolution boxes are only diffed against it. */
    evolutions: readonly EvolutionEdge[];
    /** Catch-rate list notes that concern this version group's games; unclassified ones fail the build. */
    catchRateNotes: readonly CatchRateNoteClassification[];
    /** Prerequisites and progression gates per game; item and encounter requirements must name one (plan §7.13). */
    unlocks: Partial<Record<GameId, readonly Unlock[]>>;
    /** Items missing from location pages, unstated prerequisites and choice groups (plan §7.13). */
    items: ItemOverrides;
    /** Statics, encounter patches, exclusive groups and event-only species (plan §7.7). */
    encounters: EncounterOverrides;
  };
}
