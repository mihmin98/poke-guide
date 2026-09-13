// FRAMEWORK-FREE: obtainability engine (plan §9). Pure functions over a version group's data. No Angular imports.
import type { GameDefinition, GameId, GenerationFeatures } from '../games/types';
import type { Encounter, EncounterMethodId, EvolutionEdge, VersionGroupData } from './models';

export interface ObtainSource {
  /** Trades are `encounter` sources with `fromDex` (the species given). */
  kind: 'encounter' | 'evolution' | 'breeding';
  locationId?: string;
  subAreaId?: string;
  method?: EncounterMethodId;
  exclusiveGroupId?: string;
  fromDex?: number;
  evolution?: EvolutionEdge;
  /** Earliest walkthrough part this source is available. */
  part: number;
}

export type UnobtainableReason = 'other-version' | 'trade-evolution' | 'event-only' | 'requires-other-game' | 'not-in-game';

export interface ChecklistEntry {
  dex: number;
  obtainable: boolean;
  /** Sorted by part, then location order. */
  sources: ObtainSource[];
  /** Exclusive groups the species depends on, directly or through a pre-evolution. */
  exclusiveGroupIds: string[];
  unobtainableReason?: UnobtainableReason;
  /** E.g. "Evolves from Kadabra by trade", "Available in blue, yellow". */
  unobtainableDetail?: string;
}

export type ChecklistGame = Pick<GameDefinition, 'id' | 'nationalDexMax'>;

type SourceMap = Map<number, Map<string, ObtainSource>>;

const LAST = Number.MAX_SAFE_INTEGER;

function edgesFor(data: VersionGroupData, game: GameId): EvolutionEdge[] {
  return data.evolutions.filter((e) => !e.games || e.games.includes(game));
}

function partOf(sources: SourceMap, dex: number): number | undefined {
  const found = sources.get(dex);
  if (!found || found.size === 0) return undefined;
  return Math.min(...[...found.values()].map((s) => s.part));
}

/** Adds a source, or lowers the part of the same source. Returns whether anything changed. */
function upsert(sources: SourceMap, dex: number, key: string, source: ObtainSource): boolean {
  let forDex = sources.get(dex);
  if (!forDex) {
    forDex = new Map();
    sources.set(dex, forDex);
  }
  const old = forDex.get(key);
  if (old && old.part <= source.part) return false;
  forDex.set(key, source);
  return true;
}

/**
 * Every source of every species in one game. `exclude` drops encounters, e.g. the other choices of an exclusive
 * group when computing the maximum in one save.
 */
function collectSources(
  data: VersionGroupData,
  game: GameId,
  features: GenerationFeatures,
  exclude?: (encounter: Encounter) => boolean,
): SourceMap {
  const sources: SourceMap = new Map();
  const unlockPart = new Map((data.unlocks[game] ?? []).map((u) => [u.id, u.part]));
  const trades: { dex: number; giveDex: number; key: string; source: ObtainSource }[] = [];

  for (const location of data.locations) {
    const placement = location.placement[game];
    if (!placement) continue;
    for (const subArea of location.subAreas) {
      subArea.encounters.forEach((encounter, index) => {
        if (!encounter.games[game]?.length || exclude?.(encounter)) return;
        const part = Math.max(placement.part, ...(encounter.requires ?? []).map((id) => unlockPart.get(id) ?? 0));
        const source: ObtainSource = {
          kind: 'encounter',
          locationId: location.id,
          subAreaId: subArea.id,
          method: encounter.method,
          part,
          ...(encounter.exclusiveGroupId ? { exclusiveGroupId: encounter.exclusiveGroupId } : {}),
          ...(encounter.trade ? { fromDex: encounter.trade.giveDex } : {}),
        };
        const key = `encounter|${location.id}|${subArea.id}|${index}`;
        if (encounter.trade) trades.push({ dex: encounter.dex, giveDex: encounter.trade.giveDex, key, source });
        else upsert(sources, encounter.dex, key, source);
      });
    }
  }

  const edges = edgesFor(data, game);
  const breeding = features.breeding ? data.breeding : null;
  const dayCareParts = (breeding?.dayCareLocationIds ?? [])
    .map((id) => data.locations.find((l) => l.id === id)?.placement[game]?.part)
    .filter((part): part is number => part !== undefined);
  const dayCarePart = dayCareParts.length > 0 ? Math.min(...dayCareParts) : undefined;
  const speciesByDex = new Map(data.species.map((s) => [s.dex, s]));
  const root = (dex: number): number => {
    const seen = new Set([dex]);
    let current = dex;
    for (;;) {
      const parent = edges.find((e) => e.to === current);
      if (!parent || seen.has(parent.from)) return current;
      seen.add(parent.from);
      current = parent.from;
    }
  };

  // Fixed point: sources only get added or cheaper, so this terminates.
  let changed = true;
  while (changed) {
    changed = false;
    for (const trade of trades) {
      const give = partOf(sources, trade.giveDex);
      if (give === undefined) continue;
      changed = upsert(sources, trade.dex, trade.key, { ...trade.source, part: Math.max(trade.source.part, give) }) || changed;
    }
    for (const edge of edges) {
      if (edge.requiresTrade) continue;
      const from = partOf(sources, edge.from);
      if (from === undefined) continue;
      const source: ObtainSource = { kind: 'evolution', fromDex: edge.from, evolution: edge, part: from };
      changed = upsert(sources, edge.to, `evolution|${edge.from}`, source) || changed;
    }
    if (breeding && dayCarePart !== undefined) {
      const ditto = partOf(sources, breeding.dittoDex);
      for (const dex of [...sources.keys()]) {
        const parentPart = partOf(sources, dex);
        const species = speciesByDex.get(dex);
        const eggGroups = species?.eggGroups ?? [];
        if (parentPart === undefined || eggGroups.length === 0) continue;
        if (eggGroups.some((g) => /undiscovered|no eggs/i.test(g))) continue;
        const bothGenders = typeof species?.genderRatio === 'number' && species.genderRatio > 0 && species.genderRatio < 1;
        const partner = dex !== breeding.dittoDex && ditto !== undefined ? ditto : bothGenders ? parentPart : undefined;
        const offspring = root(dex);
        if (partner === undefined || offspring === dex) continue;
        // Baby items aren't modelled as obtainable items yet, so those offspring don't count as bred.
        if (breeding.babyItemRequirements?.some((r) => r.offspring === offspring)) continue;
        const source: ObtainSource = { kind: 'breeding', fromDex: dex, part: Math.max(parentPart, partner, dayCarePart) };
        changed = upsert(sources, offspring, `breeding|${dex}`, source) || changed;
      }
    }
  }
  return sources;
}

function countObtainable(sources: SourceMap, max: number): number {
  let count = 0;
  for (let dex = 1; dex <= max; dex++) if ((sources.get(dex)?.size ?? 0) > 0) count++;
  return count;
}

export function buildChecklist(
  data: VersionGroupData,
  game: ChecklistGame,
  features: GenerationFeatures,
): ChecklistEntry[] {
  const sources = collectSources(data, game.id, features);
  const others = data.games.filter((g) => g !== game.id).map((g) => [g, collectSources(data, g, features)] as const);
  const edges = edgesFor(data, game.id);
  const nameOf = (dex: number) => data.species.find((s) => s.dex === dex)?.name ?? `#${dex}`;
  const locationOrder = new Map(data.locations.map((l) => [l.id, l.placement[game.id]?.order ?? LAST]));
  const orderOf = (s: ObtainSource) => (s.locationId ? (locationOrder.get(s.locationId) ?? LAST) : LAST);

  const groupMemo = new Map<number, Set<string>>();
  const groupsOf = (dex: number, visiting = new Set<number>()): Set<string> => {
    const memo = groupMemo.get(dex);
    if (memo) return memo;
    const ids = new Set<string>();
    if (visiting.has(dex)) return ids;
    visiting.add(dex);
    for (const source of sources.get(dex)?.values() ?? []) {
      if (source.exclusiveGroupId) ids.add(source.exclusiveGroupId);
      if (source.kind === 'evolution' && source.fromDex !== undefined)
        for (const id of groupsOf(source.fromDex, visiting)) ids.add(id);
    }
    groupMemo.set(dex, ids);
    return ids;
  };

  const entries: ChecklistEntry[] = [];
  for (let dex = 1; dex <= game.nationalDexMax; dex++) {
    const list = [...(sources.get(dex)?.values() ?? [])].sort((a, b) => a.part - b.part || orderOf(a) - orderOf(b));
    const entry: ChecklistEntry = { dex, obtainable: list.length > 0, sources: list, exclusiveGroupIds: [...groupsOf(dex)] };
    if (!entry.obtainable) {
      const tradeEdge = edges.find((e) => e.to === dex && e.requiresTrade && sources.has(e.from));
      const elsewhere = others.filter(([, s]) => (s.get(dex)?.size ?? 0) > 0).map(([g]) => g);
      if (data.eventOnly.includes(dex)) {
        entry.unobtainableReason = 'event-only';
      } else if (tradeEdge) {
        entry.unobtainableReason = 'trade-evolution';
        entry.unobtainableDetail = `Evolves from ${nameOf(tradeEdge.from)} by trade`;
      } else if (elsewhere.length > 0) {
        entry.unobtainableReason = 'other-version';
        entry.unobtainableDetail = `Available in ${elsewhere.join(', ')}`;
      } else {
        entry.unobtainableReason = 'not-in-game';
      }
    }
    entries.push(entry);
  }
  return entries;
}

/**
 * The most species one save can hold: for each exclusive group of the game, only one choice is kept, and the
 * species that then lose every source (the other choices' evolution families) are subtracted. Groups are assumed
 * independent of each other.
 */
export function maxInOneSave(
  data: VersionGroupData,
  game: ChecklistGame,
  features: GenerationFeatures,
  entries: readonly ChecklistEntry[] = buildChecklist(data, game, features),
): number {
  const obtainable = entries.filter((e) => e.obtainable).length;
  let lost = 0;
  for (const group of data.exclusiveGroups) {
    if (!group.games.includes(game.id)) continue;
    const costs = group.members.map((choice) => {
      const kept = collectSources(data, game.id, features, (e) => e.exclusiveGroupId === group.id && e.dex !== choice);
      return obtainable - countObtainable(kept, game.nationalDexMax);
    });
    if (costs.length > 0) lost += Math.min(...costs);
  }
  return obtainable - lost;
}
