// Pure view model for the Pokémon detail page (plan §13.7): no Angular, so it can be unit-tested on its own.
import { evolutionDetailText } from '../../shared/evolution-text';
import type { GameView } from '../../core/domain/game-view';
import { unionLevels } from '../../core/domain/levels';
import type {
  EncounterSlot,
  GameId,
  LevelSpec,
  Move,
  PokedexData,
  Rate,
  Species,
  TimeOfDay,
  VersionGroupData,
} from '../../core/domain/models';
import { TIMES_OF_DAY, timeOfDayLabel } from '../../core/games/conditions';
import type { ChecklistEntry, UnobtainableReason } from '../../core/domain/obtainability';
import { findMethod } from '../../core/games/methods';
import { describeSource, type ChecklistSource } from '../checklist/checklist-model';

export interface EvolutionStep {
  fromDex: number;
  fromName: string;
  toDex: number;
  toName: string;
  /** "Lv 16", "Fire Stone", "Trade". */
  detail: string;
  requiresTrade: boolean;
}

/** Where a species is found in one of the version group's other games (plan §13.7). */
export interface OtherGamePlace {
  locationId: string;
  locationName: string;
  methodLabel: string;
  levels: LevelSpec | null;
  /** The best rate over every slot (a percentage wins over a one-off). */
  rate: Rate | undefined;
  /** `Night` or `Morning, day` when the species only appears at some times of day. */
  times?: string;
}

export interface OtherGameEntry {
  game: GameId;
  places: OtherGamePlace[];
}

export interface LevelUpMove {
  level: number;
  move: Move;
}

export interface PrevoMove {
  move: Move;
  /** Names of the pre-evolutions that learn it. */
  from: string[];
}

export interface PokemonLearnset {
  levelUp: LevelUpMove[];
  machines: Move[];
  prevo: PrevoMove[];
  /** Egg moves (Gen II+). */
  egg: Move[];
  /** Move tutor moves available in this game. */
  tutor: Move[];
}

export interface PokemonEntryText {
  games: GameId[];
  text: string;
}

export interface PokemonView {
  species: Species;
  obtainable: boolean;
  unobtainableReason?: UnobtainableReason;
  unobtainableDetail?: string;
  sources: ChecklistSource[];
  exclusiveGroupLabels: string[];
  otherGames: OtherGameEntry[];
  /** The whole evolution family this species belongs to, in order. */
  family: EvolutionStep[];
  previous: { slug: string; name: string } | undefined;
  next: { slug: string; name: string } | undefined;
}

/** Every edge of the species' family, walked up to the root and then down through every branch. */
function familyOf(view: GameView, dex: number): EvolutionStep[] {
  const nameOf = (d: number) => view.speciesByDex.get(d)?.name ?? `#${d}`;
  const seen = new Set<number>([dex]);
  let root = dex;
  for (;;) {
    const parent = view.evolutionsTo.get(root)?.[0];
    if (!parent || seen.has(parent.from)) break;
    seen.add(parent.from);
    root = parent.from;
  }

  const steps: EvolutionStep[] = [];
  const visited = new Set<number>();
  const walk = (from: number): void => {
    if (visited.has(from)) return;
    visited.add(from);
    for (const edge of view.evolutionsFrom.get(from) ?? []) {
      steps.push({
        fromDex: edge.from,
        fromName: nameOf(edge.from),
        toDex: edge.to,
        toName: nameOf(edge.to),
        detail: evolutionDetailText(edge),
        requiresTrade: edge.requiresTrade,
      });
      walk(edge.to);
    }
  };
  walk(root);
  return steps;
}

function bestRate(slots: readonly EncounterSlot[]): Rate | undefined {
  const percents = slots.flatMap((slot) => (slot.rate.kind === 'percent' ? [slot.rate] : []));
  if (!percents.length) return slots[0]?.rate;
  return percents.reduce((best, rate) => (rate.value > best.value ? rate : best));
}

/** The times of day the slots cover, or `undefined` when that's all day (or the game has no clock). */
function timesOf(slots: readonly EncounterSlot[]): string | undefined {
  const times = new Set<TimeOfDay>();
  for (const slot of slots) {
    const time = slot.conditions?.find((c) => c.kind === 'time')?.value as TimeOfDay | undefined;
    if (!time) return undefined;
    times.add(time);
  }
  if (!times.size || times.size === TIMES_OF_DAY.length) return undefined;
  const text = TIMES_OF_DAY.filter((t) => times.has(t))
    .map((t) => timeOfDayLabel(t).toLowerCase())
    .join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function placesIn(data: VersionGroupData, dex: number, game: GameId): OtherGamePlace[] {
  const places: OtherGamePlace[] = [];
  for (const location of data.locations) {
    if (!location.placement[game]) continue;
    for (const subArea of location.subAreas) {
      for (const encounter of subArea.encounters) {
        const slots = encounter.games[game];
        if (encounter.dex !== dex || !slots?.length) continue;
        const times = timesOf(slots);
        places.push({
          locationId: location.id,
          locationName: location.name,
          methodLabel: findMethod(encounter.method)?.label ?? encounter.method,
          levels: slots.reduce<LevelSpec | null>((acc, slot) => unionLevels(acc, slot.levels), null),
          rate: bestRate(slots),
          ...(times ? { times } : {}),
        });
      }
    }
  }
  return places;
}

export interface PokemonInput {
  data: VersionGroupData;
  view: GameView;
  game: GameId;
  /** A slug (`pikachu`) or a National Dex number as text (`25`). */
  key: string;
  entries: readonly ChecklistEntry[];
}

/** Everything the detail page shows, or `undefined` when the species is not in this version group. */
export function buildPokemonView(input: PokemonInput): PokemonView | undefined {
  const { data, view, game, key } = input;
  const species =
    view.speciesBySlug.get(key) ??
    (/^\d+$/.test(key) ? view.speciesByDex.get(Number(key)) : undefined);
  if (!species) return undefined;

  const entry = input.entries.find((e) => e.dex === species.dex);
  const groupLabels = (view.groupsByDex.get(species.dex) ?? []).map((g) => g.label);
  const index = data.species.findIndex((s) => s.dex === species.dex);
  const neighbour = (at: number) => {
    const found = data.species[at];
    return found ? { slug: found.slug, name: found.name } : undefined;
  };

  return {
    species,
    obtainable: entry?.obtainable ?? false,
    ...(entry?.unobtainableReason === undefined
      ? {}
      : { unobtainableReason: entry.unobtainableReason }),
    ...(entry?.unobtainableDetail === undefined
      ? {}
      : { unobtainableDetail: entry.unobtainableDetail }),
    sources: (entry?.sources ?? []).map((source) => describeSource(source, view)),
    exclusiveGroupLabels: groupLabels,
    otherGames: data.games
      .filter((other) => other !== game)
      .map((other) => ({ game: other, places: placesIn(data, species.dex, other) }))
      .filter((other) => other.places.length > 0),
    family: familyOf(view, species.dex),
    previous: neighbour(index - 1),
    next: neighbour(index + 1),
  };
}

/** The learnset for one species in one game, with move data resolved (plan §7.12). */
export function buildLearnset(
  pokedex: PokedexData | undefined,
  dex: number,
  game: GameId,
  nameOf: (dex: number) => string,
): PokemonLearnset {
  const learnset = pokedex?.learnsets[String(dex)];
  const moves = new Map((pokedex?.moves ?? []).map((move) => [move.id, move]));
  if (!learnset) return { levelUp: [], machines: [], prevo: [], egg: [], tutor: [] };

  const levelUp: LevelUpMove[] = [];
  for (const row of learnset.levelUp) {
    const level = row.levels[game];
    const move = moves.get(row.move);
    if (level === undefined || !move) continue;
    levelUp.push({ level, move });
  }
  levelUp.sort((a, b) => a.level - b.level || a.move.name.localeCompare(b.move.name));

  const machines = learnset.machines
    .map((id) => moves.get(id))
    .filter((move): move is Move => move !== undefined)
    .sort((a, b) => (a.machine ?? '').localeCompare(b.machine ?? ''));

  const prevo: PrevoMove[] = [];
  for (const row of learnset.prevo) {
    const move = moves.get(row.move);
    if (!move || (row.games && !row.games.includes(game))) continue;
    prevo.push({ move, from: row.fromDex.map(nameOf) });
  }

  const byName = (a: Move, b: Move) => a.name.localeCompare(b.name);
  const egg = (learnset.egg ?? [])
    .map((id) => moves.get(id))
    .filter((move): move is Move => move !== undefined)
    .sort(byName);
  const tutor = (learnset.tutor ?? [])
    .filter((row) => !row.games || row.games.includes(game))
    .map((row) => moves.get(row.move))
    .filter((move): move is Move => move !== undefined)
    .sort(byName);

  return { levelUp, machines, prevo, egg, tutor };
}

/** `50% ♂ · 50% ♀` · `Male only` · `Genderless`, from `Species.genderRatio` (the female fraction). */
export function genderText(ratio: number | 'genderless'): string {
  if (ratio === 'genderless') return 'Genderless';
  if (ratio === 0) return 'Male only';
  if (ratio === 1) return 'Female only';
  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
  return `${percent(1 - ratio)} ♂ · ${percent(ratio)} ♀`;
}

/** Pokédex entries for this species, the game's own first (plan §13.7). */
export function entriesFor(
  pokedex: PokedexData | undefined,
  dex: number,
  game: GameId,
): PokemonEntryText[] {
  const entries = pokedex?.entries[String(dex)] ?? [];
  return [...entries].sort((a, b) => Number(b.games.includes(game)) - Number(a.games.includes(game)));
}
