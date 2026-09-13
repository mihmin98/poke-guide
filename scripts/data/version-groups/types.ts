/**
 * Version-group pipeline configuration (plan §7.1). Fields are added as the pipeline grows
 * (overrides, extra parsers, sprites).
 */
import type {
  EvolutionEdge,
  GameId,
  LocationKind,
  RegionId,
  VersionGroupId,
  WalkthroughPart,
} from '../../../src/app/core/domain/models';
import type { CatchTemplateAdapter } from '../adapters/catch-template-adapter';
import type { CatchRateNoteClassification } from '../core/catch-rate-history';

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
  overrides: {
    /** Authoritative evolution graph; parsed evolution boxes are only diffed against it. */
    evolutions: readonly EvolutionEdge[];
    /** Catch-rate list notes that concern this version group's games; unclassified ones fail the build. */
    catchRateNotes: readonly CatchRateNoteClassification[];
  };
}
