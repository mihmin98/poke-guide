// FRAMEWORK-FREE: imported by the Angular app and the Node data pipeline. No Angular imports.

/** Extended as games are added. Never rename an existing id: it appears in URLs and saved state. */
export type GameId =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'gold'
  | 'silver'
  | 'crystal'
  | 'ruby'
  | 'sapphire'
  | 'emerald'
  | 'firered'
  | 'leafgreen'
  | 'diamond'
  | 'pearl'
  | 'platinum'
  | 'heartgold'
  | 'soulsilver'
  | 'black'
  | 'white'
  | 'black2'
  | 'white2';

export type VersionGroupId = 'rby' | 'gsc' | 'rse' | 'frlg' | 'dppt' | 'hgss' | 'bw' | 'b2w2';

export type RegionId = 'kanto' | 'johto' | 'hoenn' | 'sevii' | 'sinnoh' | 'unova';

export type GameStatus = 'available' | 'planned';

/** Capability flags per generation. App code branches on these, never on a game id. */
export interface GenerationFeatures {
  /** Day Care eggs (Gen II+). */
  breeding: boolean;
  /** Morning/day/night encounter slots (Gen II, IV). */
  timeOfDay: boolean;
  /** Weekday events (Gen II, IV). */
  dayOfWeek: boolean;
  /** Seasons (Gen V). */
  seasons: boolean;
  /** Held items (Gen II+). */
  heldItems: boolean;
  /** Friendship evolutions (Gen II+). */
  friendship: boolean;
  /** Abilities (Gen III+). Reserved; not shown yet. */
  abilities: boolean;
}

export interface GameDefinition {
  id: GameId;
  /** Stable numeric id used by `PKG1-` export codes. NEVER reuse or change one. */
  codecId: number;
  name: string;
  shortName: string;
  versionGroupId: VersionGroupId;
  generation: number;
  regions: RegionId[];
  /** Sort order in the game picker. */
  releaseOrder: number;
  /** North American release year, shown next to the name in the game picker. */
  releaseYear: number;
  nationalDexMax: number;
  regionalDex?: { id: string; name: string };
  /** Hex seed; full M3 palettes are generated from it by `npm run theme:games`. */
  accent: { seed: string };
  spriteSetId: string;
  /** `planned` games show as "Coming Soon" in the picker and only open in dev builds. */
  status: GameStatus;
}

export interface VersionGroupDefinition {
  id: VersionGroupId;
  games: GameId[];
  generation: number;
  /** Relative URL of the generated data file, e.g. `data/rby.json`. */
  dataFile: string;
  features: GenerationFeatures;
  /** Selects `core/mechanics/<mechanicsId>.ts`. */
  mechanicsId: string;
  /**
   * The data file has story milestones (plan §7.14), so the nav offers the Story page without loading the data
   * first. The data validator keeps this flag and the data in step.
   */
  storyChecklist?: true;
}
