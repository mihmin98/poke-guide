// FRAMEWORK-FREE: per-game indexes over a version group's data (plan §11.4). No Angular imports.
import { getMethod, type EncounterMethodDefinition } from '../games/methods';
import type {
  Encounter,
  EncounterSlot,
  EvolutionEdge,
  ExclusiveGroup,
  GameId,
  GameLocation,
  Species,
  Unlock,
  VersionGroupData,
  WalkthroughPart,
} from './models';

export interface GameView {
  species: readonly Species[];
  speciesByDex: ReadonlyMap<number, Species>;
  speciesBySlug: ReadonlyMap<string, Species>;
  /** Locations in this game, in walkthrough order. */
  locations: readonly GameLocation[];
  locationById: ReadonlyMap<string, GameLocation>;
  /** Edges that apply to this game, keyed by the pre-evolution. */
  evolutionsFrom: ReadonlyMap<number, readonly EvolutionEdge[]>;
  /** Edges that apply to this game, keyed by the evolved species. */
  evolutionsTo: ReadonlyMap<number, readonly EvolutionEdge[]>;
  unlocks: readonly Unlock[];
  walkthrough: readonly WalkthroughPart[];
  /** Exclusive groups in this game that a species is a member of. */
  groupsByDex: ReadonlyMap<number, readonly ExclusiveGroup[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildGameView(data: VersionGroupData, game: GameId): GameView {
  const locations = data.locations
    .filter((l) => l.placement[game])
    .sort((a, b) => a.placement[game]!.order - b.placement[game]!.order);

  const evolutionsFrom = new Map<number, EvolutionEdge[]>();
  const evolutionsTo = new Map<number, EvolutionEdge[]>();
  for (const edge of data.evolutions) {
    if (edge.games && !edge.games.includes(game)) continue;
    push(evolutionsFrom, edge.from, edge);
    push(evolutionsTo, edge.to, edge);
  }

  const groupsByDex = new Map<number, ExclusiveGroup[]>();
  for (const group of data.exclusiveGroups) {
    if (!group.games.includes(game)) continue;
    for (const dex of group.members) push(groupsByDex, dex, group);
  }

  return {
    species: data.species,
    speciesByDex: new Map(data.species.map((s) => [s.dex, s])),
    speciesBySlug: new Map(data.species.map((s) => [s.slug, s])),
    locations,
    locationById: new Map(locations.map((l) => [l.id, l])),
    evolutionsFrom,
    evolutionsTo,
    unlocks: data.unlocks[game] ?? [],
    walkthrough: data.walkthroughs[game] ?? [],
    groupsByDex,
  };
}

/** An encounter narrowed to one game: `slots` replaces the per-game `games` map. */
export interface GameEncounter extends Omit<Encounter, 'games'> {
  slots: readonly EncounterSlot[];
}

export interface EncounterSection {
  method: EncounterMethodDefinition;
  encounters: readonly GameEncounter[];
}

export interface SubAreaEncounters {
  id: string;
  name: string | null;
  sections: readonly EncounterSection[];
}

/**
 * A location's encounters in one game, per sub-area (page order) and method section (`sectionOrder`).
 * Encounters keep their data order within a section; sub-areas without encounters in the game are dropped.
 */
export function encountersFor(location: GameLocation, game: GameId): SubAreaEncounters[] {
  const result: SubAreaEncounters[] = [];
  for (const subArea of location.subAreas) {
    const byMethod = new Map<string, GameEncounter[]>();
    for (const { games, ...encounter } of subArea.encounters) {
      const slots = games[game];
      if (slots?.length) push(byMethod, encounter.method, { ...encounter, slots });
    }
    if (byMethod.size === 0) continue;
    const sections = [...byMethod]
      .map(([method, encounters]) => ({ method: getMethod(method), encounters }))
      .sort((a, b) => a.method.sectionOrder - b.method.sectionOrder);
    result.push({ id: subArea.id, name: subArea.name, sections });
  }
  return result;
}
