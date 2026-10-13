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
  sinnoh: 'Sinnoh',
  unova: 'Unova',
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

const GEN4_FEATURES: GenerationFeatures = {
  breeding: true,
  timeOfDay: true,
  dayOfWeek: true,
  seasons: false,
  heldItems: true,
  friendship: true,
  abilities: true,
};

const GEN5_FEATURES: GenerationFeatures = {
  breeding: true,
  timeOfDay: false,
  dayOfWeek: false,
  seasons: true,
  heldItems: true,
  friendship: true,
  abilities: true,
};

/** Codec ids are a compatibility contract with every export code ever produced. */
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
    releaseYear: 1998,
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
    releaseYear: 1998,
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
    releaseYear: 1999,
    nationalDexMax: 151,
    accent: { seed: '#FFCB05' },
    spriteSetId: 'gen1-y',
    status: 'available',
  },
  {
    id: 'gold',
    codecId: 4,
    name: 'Pokémon Gold',
    shortName: 'Gold',
    versionGroupId: 'gsc',
    generation: 2,
    regions: ['johto', 'kanto'],
    releaseOrder: 4,
    releaseYear: 2000,
    nationalDexMax: 251,
    regionalDex: { id: 'johto', name: 'New Pokédex' },
    accent: { seed: '#B8860B' },
    spriteSetId: 'gen2-g',
    status: 'available',
  },
  {
    id: 'silver',
    codecId: 5,
    name: 'Pokémon Silver',
    shortName: 'Silver',
    versionGroupId: 'gsc',
    generation: 2,
    regions: ['johto', 'kanto'],
    releaseOrder: 5,
    releaseYear: 2000,
    nationalDexMax: 251,
    regionalDex: { id: 'johto', name: 'New Pokédex' },
    accent: { seed: '#8A9BB0' },
    spriteSetId: 'gen2-s',
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
    releaseOrder: 6,
    releaseYear: 2001,
    nationalDexMax: 251,
    regionalDex: { id: 'johto', name: 'New Pokédex' },
    accent: { seed: '#4FB8D6' },
    spriteSetId: 'gen2-c',
    status: 'available',
  },
  {
    id: 'ruby',
    codecId: 7,
    name: 'Pokémon Ruby',
    shortName: 'Ruby',
    versionGroupId: 'rse',
    generation: 3,
    regions: ['hoenn'],
    releaseOrder: 7,
    releaseYear: 2003,
    nationalDexMax: 386,
    regionalDex: { id: 'hoenn', name: 'Hoenn Pokédex' },
    accent: { seed: '#C8102E' },
    spriteSetId: 'gen3-rs',
    status: 'planned',
  },
  {
    id: 'sapphire',
    codecId: 8,
    name: 'Pokémon Sapphire',
    shortName: 'Sapphire',
    versionGroupId: 'rse',
    generation: 3,
    regions: ['hoenn'],
    releaseOrder: 8,
    releaseYear: 2003,
    nationalDexMax: 386,
    regionalDex: { id: 'hoenn', name: 'Hoenn Pokédex' },
    accent: { seed: '#1F4FA8' },
    spriteSetId: 'gen3-rs',
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
    releaseOrder: 9,
    releaseYear: 2004,
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
    releaseOrder: 10,
    releaseYear: 2004,
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
    releaseOrder: 11,
    releaseYear: 2005,
    nationalDexMax: 386,
    regionalDex: { id: 'hoenn', name: 'Hoenn Pokédex' },
    accent: { seed: '#00A86B' },
    spriteSetId: 'gen3-e',
    status: 'planned',
  },
  {
    id: 'diamond',
    codecId: 12,
    name: 'Pokémon Diamond',
    shortName: 'Diamond',
    versionGroupId: 'dppt',
    generation: 4,
    regions: ['sinnoh'],
    releaseOrder: 12,
    releaseYear: 2007,
    nationalDexMax: 493,
    regionalDex: { id: 'sinnoh', name: 'Sinnoh Pokédex' },
    accent: { seed: '#5B8FC9' },
    spriteSetId: 'gen4-dp',
    status: 'planned',
  },
  {
    id: 'pearl',
    codecId: 13,
    name: 'Pokémon Pearl',
    shortName: 'Pearl',
    versionGroupId: 'dppt',
    generation: 4,
    regions: ['sinnoh'],
    releaseOrder: 13,
    releaseYear: 2007,
    nationalDexMax: 493,
    regionalDex: { id: 'sinnoh', name: 'Sinnoh Pokédex' },
    accent: { seed: '#D48AA0' },
    spriteSetId: 'gen4-dp',
    status: 'planned',
  },
  {
    id: 'platinum',
    codecId: 14,
    name: 'Pokémon Platinum',
    shortName: 'Platinum',
    versionGroupId: 'dppt',
    generation: 4,
    regions: ['sinnoh'],
    releaseOrder: 14,
    releaseYear: 2009,
    nationalDexMax: 493,
    regionalDex: { id: 'sinnoh', name: 'Sinnoh Pokédex' },
    accent: { seed: '#9B7B3F' },
    spriteSetId: 'gen4-pt',
    status: 'planned',
  },
  {
    id: 'heartgold',
    codecId: 15,
    name: 'Pokémon HeartGold',
    shortName: 'HeartGold',
    versionGroupId: 'hgss',
    generation: 4,
    regions: ['johto', 'kanto'],
    releaseOrder: 15,
    releaseYear: 2010,
    nationalDexMax: 493,
    regionalDex: { id: 'johto', name: 'Johto Pokédex' },
    accent: { seed: '#D4A017' },
    spriteSetId: 'gen4-hgss',
    status: 'planned',
  },
  {
    id: 'soulsilver',
    codecId: 16,
    name: 'Pokémon SoulSilver',
    shortName: 'SoulSilver',
    versionGroupId: 'hgss',
    generation: 4,
    regions: ['johto', 'kanto'],
    releaseOrder: 16,
    releaseYear: 2010,
    nationalDexMax: 493,
    regionalDex: { id: 'johto', name: 'Johto Pokédex' },
    accent: { seed: '#6F8FBF' },
    spriteSetId: 'gen4-hgss',
    status: 'planned',
  },
  {
    id: 'black',
    codecId: 17,
    name: 'Pokémon Black',
    shortName: 'Black',
    versionGroupId: 'bw',
    generation: 5,
    regions: ['unova'],
    releaseOrder: 17,
    releaseYear: 2011,
    nationalDexMax: 649,
    regionalDex: { id: 'unova', name: 'Unova Pokédex' },
    accent: { seed: '#2E5C8A' },
    spriteSetId: 'gen5-bw',
    status: 'planned',
  },
  {
    id: 'white',
    codecId: 18,
    name: 'Pokémon White',
    shortName: 'White',
    versionGroupId: 'bw',
    generation: 5,
    regions: ['unova'],
    releaseOrder: 18,
    releaseYear: 2011,
    nationalDexMax: 649,
    regionalDex: { id: 'unova', name: 'Unova Pokédex' },
    accent: { seed: '#E0703A' },
    spriteSetId: 'gen5-bw',
    status: 'planned',
  },
  {
    id: 'black2',
    codecId: 19,
    name: 'Pokémon Black 2',
    shortName: 'Black 2',
    versionGroupId: 'b2w2',
    generation: 5,
    regions: ['unova'],
    releaseOrder: 19,
    releaseYear: 2012,
    nationalDexMax: 649,
    regionalDex: { id: 'unova-b2w2', name: 'New Unova Pokédex' },
    accent: { seed: '#1E7A8C' },
    spriteSetId: 'gen5-b2w2',
    status: 'planned',
  },
  {
    id: 'white2',
    codecId: 20,
    name: 'Pokémon White 2',
    shortName: 'White 2',
    versionGroupId: 'b2w2',
    generation: 5,
    regions: ['unova'],
    releaseOrder: 20,
    releaseYear: 2012,
    nationalDexMax: 649,
    regionalDex: { id: 'unova-b2w2', name: 'New Unova Pokédex' },
    accent: { seed: '#C9533B' },
    spriteSetId: 'gen5-b2w2',
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
    storyChecklist: true,
  },
  {
    id: 'gsc',
    games: ['gold', 'silver', 'crystal'],
    generation: 2,
    dataFile: 'data/gsc.json',
    features: GEN2_FEATURES,
    mechanicsId: 'gen2',
    storyChecklist: true,
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
    games: ['ruby', 'sapphire', 'emerald'],
    generation: 3,
    dataFile: 'data/rse.json',
    features: GEN3_FEATURES,
    mechanicsId: 'gen3',
  },
  {
    id: 'dppt',
    games: ['diamond', 'pearl', 'platinum'],
    generation: 4,
    dataFile: 'data/dppt.json',
    features: GEN4_FEATURES,
    mechanicsId: 'gen4',
  },
  {
    id: 'hgss',
    games: ['heartgold', 'soulsilver'],
    generation: 4,
    dataFile: 'data/hgss.json',
    features: GEN4_FEATURES,
    mechanicsId: 'gen4',
  },
  {
    id: 'bw',
    games: ['black', 'white'],
    generation: 5,
    dataFile: 'data/bw.json',
    features: GEN5_FEATURES,
    mechanicsId: 'gen5',
  },
  {
    id: 'b2w2',
    games: ['black2', 'white2'],
    generation: 5,
    dataFile: 'data/b2w2.json',
    features: GEN5_FEATURES,
    mechanicsId: 'gen5',
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
  /** One row per version group, each in release order. Rows are ordered by their first release. */
  rows: GameDefinition[][];
}

export function groupGamesByGeneration(games: readonly GameDefinition[]): GenerationGroup[] {
  // A Map keeps insertion order, so walking the games in release order orders the rows by first release.
  const rows = new Map<VersionGroupId, GameDefinition[]>();
  for (const game of [...games].sort((a, b) => a.releaseOrder - b.releaseOrder)) {
    rows.set(game.versionGroupId, [...(rows.get(game.versionGroupId) ?? []), game]);
  }
  const groups = new Map<number, GameDefinition[][]>();
  for (const row of rows.values()) {
    const generation = row[0]!.generation;
    groups.set(generation, [...(groups.get(generation) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([generation, list]) => ({ generation, rows: list }));
}
