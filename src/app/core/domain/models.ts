// FRAMEWORK-FREE: data model shared by the data pipeline and the app (plan §8). No Angular imports.
import type { EncounterCondition, TimeOfDay } from '../games/conditions';
import type { PokemonType } from '../games/pokemon-types';
import type { GameId, RegionId, VersionGroupId } from '../games/types';

export type { EncounterCondition, GameId, PokemonType, RegionId, TimeOfDay, VersionGroupId };

/** Validated against `core/games/methods.ts`. */
export type EncounterMethodId = string;

/** `spc` is the single Gen I Special stat. */
export type StatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'spc';

export interface LevelSpec {
  min: number;
  max: number;
  /** Only present when the levels are not one continuous range, e.g. `8, 10, 12`. */
  values?: number[];
}

export type Rate =
  | { kind: 'percent'; value: number }
  | { kind: 'once' }
  /** In-game currency. */
  | { kind: 'price'; value: number }
  /** Game Corner coins. */
  | { kind: 'coins'; value: number }
  | { kind: 'unknown'; text: string };

export interface EncounterSlot {
  levels: LevelSpec | null;
  rate: Rate;
  conditions?: EncounterCondition[];
  ivs?:
    | { kind: 'fixed'; values: Partial<Record<StatId, number>> }
    | { kind: 'min-perfect'; count: number };
  /** Absent means the generation's base odds apply. */
  shiny?: 'locked' | 'guaranteed';
  catchRateOverride?: number;
  note?: string;
}

export interface Encounter {
  dex: number;
  method: EncounterMethodId;
  games: Partial<Record<GameId, EncounterSlot[]>>;
  /** Unlock ids. */
  requires?: string[];
  exclusiveGroupId?: string;
  trade?: { giveDex: number; nickname?: string };
  label?: string;
  note?: string;
}

export interface SubArea {
  id: string;
  name: string | null;
  encounters: Encounter[];
}

export type LocationKind = 'town' | 'route' | 'cave' | 'building' | 'water' | 'special';

export interface GameLocation {
  id: string;
  name: string;
  region: RegionId;
  kind: LocationKind;
  /** Absent for a game means the location is not in that game. */
  placement: Partial<Record<GameId, { part: number; order: number }>>;
  source: { title: string; revid: number };
  notes: string[];
  subAreas: SubArea[];
  /** Items found here (plan §7.13), in page order. */
  items: LocationItem[];
  /** Item-related notes, e.g. fake item balls or a Berry tree. */
  itemNotes: ItemNote[];
}

/**
 * A plain string applies to every game of the version group; the object form names its games (a Crystal-only
 * phone-call gift).
 */
export type ItemNote = string | { text: string; games: GameId[] };

export type ItemObtainMethod = 'pickup' | 'gift' | 'reward' | 'drop' | 'choice' | 'purchase';

export interface LocationItem {
  /**
   * Stable within the version group and never reused (plan §7.13): profiles store these in `itemsTaken`
   * and `PKG2` codes carry them, so they are a compatibility contract like a game's `codecId`.
   */
  no: number;
  itemId: string;
  /** As spelled for the generation: "TM28 Dig", "Coins". */
  name: string;
  quantity: number;
  games: GameId[];
  obtain: ItemObtainMethod;
  hidden?: true;
  /** A heading or floor ("B4F"). */
  subArea: string | null;
  /** Plain text, without the parsed markers. */
  where: string;
  /** AND of alternatives, as unlock ids: `[['cut', 'surf']]` is Cut or Surf. */
  requires?: string[][];
  /** Price in Game Corner coins (`obtain: 'purchase'`). */
  coins?: number;
  /** Only reachable later than the location's part (Viridian Gym TM). */
  fromPart?: Partial<Record<GameId, number>>;
  choiceGroupId?: string;
  /** Only on override items taken from another page. */
  source?: { title: string; revid: number };
}

export type GrowthRate =
  'erratic' | 'fast' | 'medium-fast' | 'medium-slow' | 'slow' | 'fluctuating';

export interface Species {
  dex: number;
  name: string;
  slug: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  regionalDex?: Partial<Record<GameId, number>>;
  /** Value for the version group's generation. */
  catchRate: number;
  /** Games whose capture uses a different value (Yellow Dragonair: 27). */
  catchRateByGame?: Partial<Record<GameId, number>>;
  catchRateNote?: string;
  /** gen1: hp/atk/def/spc/spe · gen2+: hp/atk/def/spa/spd/spe */
  baseStats: Partial<Record<StatId, number>>;
  /** Pokédex category without the " Pokémon" suffix, as shown in the generation ("Seed"). */
  category: string;
  heightM: number;
  weightKg: number;
  /** Base experience yield for the generation. */
  baseExp: number;
  growthRate: GrowthRate;
  /**
   * Effort values given when defeated (Gen III+). Absent in Gen I–II, where the stat experience gained
   * equals the defeated species' base stats (see `core/mechanics`).
   */
  evYield?: Partial<Record<StatId, number>>;
  /** Only when the breeding feature is on. */
  eggGroups?: string[];
  genderRatio?: number | 'genderless';
}

/** A move as it works in the version group's generation. Ids are only unique within one data file. */
export interface Move {
  id: string;
  /** Name as spelled in the generation (Gen I: "ThunderShock"). */
  name: string;
  type: PokemonType;
  /** `null` for status moves and moves with variable damage. */
  power: number | null;
  /** `null` for moves that never miss. */
  accuracy: number | null;
  pp: number;
  /** `TM24`, `HM05`. */
  machine?: string;
}

export interface Learnset {
  /** One row per learn event; a game missing from `levels` can't learn the move by level in that game. */
  levelUp: { move: string; levels: Partial<Record<GameId, number>> }[];
  /** Move ids learnable by TM/HM. */
  machines: string[];
  /** Moves only previous evolutions learn by level; `games` absent means every game of the version group. */
  prevo: { move: string; fromDex: number[]; games?: GameId[] }[];
  /**
   * Egg moves (Gen II+); absent when the generation has no breeding or the species has none. `games` absent means
   * every game of the version group (Crystal dropped some Gold/Silver egg moves and added others).
   */
  egg?: { move: string; games?: GameId[] }[];
  /** Move tutor moves; `games` absent means every game of the version group (Crystal's tutor is Crystal only). */
  tutor?: { move: string; games?: GameId[] }[];
}

export interface PokedexEntryText {
  games: GameId[];
  text: string;
}

/**
 * Pokédex details for one version group (`public/data/<versionGroup>.pokedex.json`), kept out of the main
 * data file so the guide and checklist don't download learnsets. Keys of the records are National Dex numbers.
 */
export interface PokedexData {
  schemaVersion: 1;
  versionGroupId: VersionGroupId;
  builtAt: string;
  moves: Move[];
  learnsets: Record<string, Learnset>;
  entries: Record<string, PokedexEntryText[]>;
  sources: SourceRef[];
}

export interface EvolutionEdge {
  from: number;
  to: number;
  trigger: 'level' | 'item' | 'trade' | 'friendship' | 'other';
  level?: number;
  item?: string;
  heldItem?: string;
  /** Time of day the evolution must happen in (Espeon: day, Umbreon: night). */
  timeOfDay?: TimeOfDay;
  /** Stat comparison at the evolution level (Tyrogue: Attack vs Defense). */
  stat?: 'atk>def' | 'atk<def' | 'atk=def';
  condition?: string;
  requiresTrade: boolean;
  /** Absent means all games in the version group. */
  games?: GameId[];
}

/** Gold/Silver/Crystal: Gen I species that can only be moved in from Red/Blue/Yellow through the Time Capsule. */
export interface RequiresOtherGame {
  dex: number[];
  /** Shown as the reason, e.g. "Transfer from Red, Blue or Yellow". */
  detail: string;
}

export interface ExclusiveGroup {
  id: string;
  label: string;
  games: GameId[];
  members: number[];
}

export interface Unlock {
  id: string;
  label: string;
  /** `move` is an HM field move, including the badge needed to use it. */
  kind: 'move' | 'key-item' | 'badge' | 'story';
  locationId: string;
  part: number;
}

export interface WalkthroughPart {
  part: number;
  title: string;
  region: RegionId;
}

export type MilestoneKind = 'gym' | 'battle' | 'event' | 'key-item' | 'encounter' | 'gift';

/** A story checklist entry (plan §7.14, Phase 11). Never counts as caught or towards any Pokémon figure. */
export interface Milestone {
  /**
   * Stable within the version group and never reused: profiles store these in `milestonesDone` and `PKG3`
   * codes carry them, so they are a compatibility contract like `LocationItem.no`.
   */
  no: number;
  /** Curated slug, unique within the version group. */
  id: string;
  label: string;
  kind: MilestoneKind;
  /** Walkthrough part per game; the keys are the games the milestone exists in. */
  part: Partial<Record<GameId, number>>;
  locationId: string;
  /** "Boulder Badge · TM34 Bide". */
  detail?: string;
  /** The badge a gym awards, as on Bulbapedia's `{{badge|…}}` ("Boulder"). */
  badge?: string;
  /** Unlock ids the milestone gives. */
  grants?: string[];
  /** The species met or received; a link only, ticking the milestone never marks it caught. */
  dex?: number;
  /** Not needed to finish the story. */
  optional?: true;
}

export interface BreedingRules {
  dayCareLocationIds: string[];
  dittoDex: number;
  babyItemRequirements?: { offspring: number; item: string }[];
}

export interface SourceRef {
  title: string;
  revid: number;
  url: string;
}

export interface VersionGroupData {
  schemaVersion: 1;
  versionGroupId: VersionGroupId;
  generation: number;
  games: GameId[];
  builtAt: string;
  types: PokemonType[];
  species: Species[];
  evolutions: EvolutionEdge[];
  breeding: BreedingRules | null;
  walkthroughs: Partial<Record<GameId, WalkthroughPart[]>>;
  unlocks: Partial<Record<GameId, Unlock[]>>;
  exclusiveGroups: ExclusiveGroup[];
  eventOnly: number[];
  /** Species that only come from other games (plan §9); absent when there are none. */
  requiresOtherGame?: RequiresOtherGame[];
  locations: GameLocation[];
  /** The story checklist (plan §7.14), in walkthrough order; absent when the version group has none. */
  milestones?: Milestone[];
  sources: SourceRef[];
}

// ---- user state ----

export interface Profile {
  /** crypto.randomUUID() */
  id: string;
  /** 1–32 characters. */
  name: string;
  game: GameId;
  /** Sorted, unique National Dex numbers. */
  caught: number[];
  /** Sorted, unique `LocationItem.no` values of the game's version group (plan §16, Phase 9). */
  itemsTaken: number[];
  /** Optional "I'm at walkthrough part N". */
  progressPart?: number;
  createdAt: string;
  updatedAt: string;
}
