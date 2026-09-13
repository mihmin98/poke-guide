// FRAMEWORK-FREE: the single source of truth for games. No Angular imports.
import type {
  GameDefinition,
  GameId,
  GenerationFeatures,
  RegionId,
  VersionGroupDefinition,
  VersionGroupId,
} from './types';

const REGION_NAMES: Record<RegionId, string> = {
  kanto: 'Kanto',
  johto: 'Johto',
  hoenn: 'Hoenn',
  sevii: 'Sevii Islands',
};

export function regionName(id: RegionId): string {
  return REGION_NAMES[id];
}

const GEN1_FEATURES: GenerationFeatures = {
  breeding: false,
  timeOfDay: false,
  dayOfWeek: false,
  seasons: false,
  heldItems: false,
  friendship: false,
  abilities: false,
};

const GEN2_FEATURES: GenerationFeatures = {
  breeding: true,
  timeOfDay: true,
  dayOfWeek: true,
  seasons: false,
  heldItems: true,
  friendship: true,
  abilities: false,
};

const GEN3_FEATURES: GenerationFeatures = {
  breeding: true,
  timeOfDay: false,
  dayOfWeek: false,
  seasons: false,
  heldItems: true,
  friendship: true,
  abilities: true,
};

/**
 * Codec ids are a compatibility contract with every export code ever produced.
 * Reserved for games not listed yet: gold = 4, silver = 5, ruby = 7, sapphire = 8.
 */
export const GAMES: readonly GameDefinition[] = [
  {
    id: 'red',
    codecId: 1,
    name: 'Pokémon Red',
    shortName: 'Red',
    versionGroupId: 'rby',
    generation: 1,
    regions: ['kanto'],
    releaseOrder: 1,
    nationalDexMax: 151,
    accent: { seed: '#E3350D' },
    spriteSetId: 'gen1-rb',
    status: 'available',
  },
  {
    id: 'blue',
    codecId: 2,
    name: 'Pokémon Blue',
    shortName: 'Blue',
    versionGroupId: 'rby',
    generation: 1,
    regions: ['kanto'],
    releaseOrder: 2,
    nationalDexMax: 151,
    accent: { seed: '#2A75BB' },
    spriteSetId: 'gen1-rb',
    status: 'available',
  },
  {
    id: 'yellow',
    codecId: 3,
    name: 'Pokémon Yellow',
    shortName: 'Yellow',
    versionGroupId: 'rby',
    generation: 1,
    regions: ['kanto'],
    releaseOrder: 3,
    nationalDexMax: 151,
    accent: { seed: '#FFCB05' },
    spriteSetId: 'gen1-y',
    status: 'available',
  },
  {
    id: 'crystal',
    codecId: 6,
    name: 'Pokémon Crystal',
    shortName: 'Crystal',
    versionGroupId: 'gsc',
    generation: 2,
    regions: ['johto', 'kanto'],
    releaseOrder: 4,
    nationalDexMax: 251,
    regionalDex: { id: 'johto', name: 'New Pokédex' },
    accent: { seed: '#4FB8D6' },
    spriteSetId: 'gen2-c',
    status: 'planned',
  },
  {
    id: 'firered',
    codecId: 10,
    name: 'Pokémon FireRed',
    shortName: 'FireRed',
    versionGroupId: 'frlg',
    generation: 3,
    regions: ['kanto', 'sevii'],
    releaseOrder: 5,
    nationalDexMax: 386,
    regionalDex: { id: 'kanto', name: 'Kanto Pokédex' },
    accent: { seed: '#F15A22' },
    spriteSetId: 'gen3-frlg',
    status: 'planned',
  },
  {
    id: 'leafgreen',
    codecId: 11,
    name: 'Pokémon LeafGreen',
    shortName: 'LeafGreen',
    versionGroupId: 'frlg',
    generation: 3,
    regions: ['kanto', 'sevii'],
    releaseOrder: 6,
    nationalDexMax: 386,
    regionalDex: { id: 'kanto', name: 'Kanto Pokédex' },
    accent: { seed: '#4E9A3A' },
    spriteSetId: 'gen3-frlg',
    status: 'planned',
  },
  {
    id: 'emerald',
    codecId: 9,
    name: 'Pokémon Emerald',
    shortName: 'Emerald',
    versionGroupId: 'rse',
    generation: 3,
    regions: ['hoenn'],
    releaseOrder: 7,
    nationalDexMax: 386,
    regionalDex: { id: 'hoenn', name: 'Hoenn Pokédex' },
    accent: { seed: '#00A86B' },
    spriteSetId: 'gen3-e',
    status: 'planned',
  },
];

export const VERSION_GROUPS: readonly VersionGroupDefinition[] = [
  {
    id: 'rby',
    games: ['red', 'blue', 'yellow'],
    generation: 1,
    dataFile: 'data/rby.json',
    features: GEN1_FEATURES,
    mechanicsId: 'gen1',
  },
  {
    id: 'gsc',
    games: ['crystal'],
    generation: 2,
    dataFile: 'data/gsc.json',
    features: GEN2_FEATURES,
    mechanicsId: 'gen2',
  },
  {
    id: 'frlg',
    games: ['firered', 'leafgreen'],
    generation: 3,
    dataFile: 'data/frlg.json',
    features: GEN3_FEATURES,
    mechanicsId: 'gen3',
  },
  {
    id: 'rse',
    games: ['emerald'],
    generation: 3,
    dataFile: 'data/rse.json',
    features: GEN3_FEATURES,
    mechanicsId: 'gen3',
  },
];

const GAMES_BY_ID: ReadonlyMap<string, GameDefinition> = new Map(GAMES.map((g) => [g.id, g]));
const GAMES_BY_CODEC_ID: ReadonlyMap<number, GameDefinition> = new Map(
  GAMES.map((g) => [g.codecId, g]),
);
const VERSION_GROUPS_BY_ID: ReadonlyMap<string, VersionGroupDefinition> = new Map(
  VERSION_GROUPS.map((vg) => [vg.id, vg]),
);

export function isGameId(value: string): value is GameId {
  return GAMES_BY_ID.has(value);
}

export function findGame(id: string): GameDefinition | undefined {
  return GAMES_BY_ID.get(id);
}

export function getGame(id: GameId): GameDefinition {
  const game = GAMES_BY_ID.get(id);
  if (!game) throw new Error(`Unknown game: ${id}`);
  return game;
}

export function findGameByCodecId(codecId: number): GameDefinition | undefined {
  return GAMES_BY_CODEC_ID.get(codecId);
}

export function getVersionGroup(id: VersionGroupId): VersionGroupDefinition {
  const group = VERSION_GROUPS_BY_ID.get(id);
  if (!group) throw new Error(`Unknown version group: ${id}`);
  return group;
}

export function versionGroupOf(game: GameDefinition): VersionGroupDefinition {
  return getVersionGroup(game.versionGroupId);
}

/** Games visible in the picker, in release order. `planned` games only when explicitly included. */
export function listGames(options: { includePlanned: boolean }): GameDefinition[] {
  return GAMES.filter((g) => options.includePlanned || g.status === 'available').sort(
    (a, b) => a.releaseOrder - b.releaseOrder,
  );
}

export interface GenerationGroup {
  generation: number;
  games: GameDefinition[];
}

export function groupGamesByGeneration(games: readonly GameDefinition[]): GenerationGroup[] {
  const groups = new Map<number, GameDefinition[]>();
  for (const game of games) {
    const list = groups.get(game.generation) ?? [];
    list.push(game);
    groups.set(game.generation, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([generation, list]) => ({ generation, games: list }));
}
