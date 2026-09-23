// Pure view model for the location page (plan §13.5): no Angular, so it can be unit-tested on its own.
import { encountersFor, type GameEncounter, type GameView } from '../../core/domain/game-view';
import { chosenInstead } from '../../core/domain/item-progress';
import type {
  EncounterSlot,
  GameId,
  GameLocation,
  LocationItem,
  PokemonType,
  Rate,
} from '../../core/domain/models';
import type { EncounterMethodDefinition } from '../../core/games/methods';

export interface LocationRow {
  key: string;
  dex: number;
  name: string;
  types: readonly PokemonType[];
  slots: readonly EncounterSlot[];
  /** Unlock labels the encounter needs. */
  requires: string[];
  exclusiveGroupLabel?: string;
  trade?: { giveDex: number; giveName: string; giveObtainable: boolean; nickname?: string };
  label?: string;
  note?: string;
  /** For the version group, with the game's and the slot's overrides applied. */
  catchRate: number | undefined;
}

export interface LocationSection {
  method: EncounterMethodDefinition;
  rows: LocationRow[];
}

export interface LocationSubArea {
  id: string;
  name: string | null;
  sections: LocationSection[];
}

export interface LocationView {
  location: GameLocation;
  part: number;
  subAreas: LocationSubArea[];
  items: LocationItem[];
  previous: { id: string; name: string } | undefined;
  next: { id: string; name: string } | undefined;
  /** Every species that can be obtained here, for "mark all as caught". */
  dexes: number[];
}

/** Percentages first, highest rate first, then National Dex order (plan §13.5). */
function rateWeight(rate: Rate | undefined): number {
  return rate?.kind === 'percent' ? rate.value : -1;
}

export function compareRows(a: LocationRow, b: LocationRow): number {
  const byRate = rateWeight(b.slots[0]?.rate) - rateWeight(a.slots[0]?.rate);
  return byRate !== 0 ? byRate : a.dex - b.dex;
}

/** The value a capture actually uses here: slot override, then per-game value, then the species value. */
export function catchRateFor(
  species: { catchRate: number; catchRateByGame?: Partial<Record<GameId, number>> } | undefined,
  game: GameId,
  slot: EncounterSlot | undefined,
): number | undefined {
  if (slot?.catchRateOverride !== undefined) return slot.catchRateOverride;
  if (!species) return undefined;
  return species.catchRateByGame?.[game] ?? species.catchRate;
}

export type CatchDifficulty = 'easy' | 'medium' | 'hard';

export function catchDifficulty(catchRate: number): CatchDifficulty {
  if (catchRate >= 150) return 'easy';
  if (catchRate >= 60) return 'medium';
  return 'hard';
}

function buildRow(
  encounter: GameEncounter,
  subAreaId: string,
  view: GameView,
  game: GameId,
  obtainable: ReadonlySet<number>,
): LocationRow {
  const species = view.speciesByDex.get(encounter.dex);
  const unlockById = new Map(view.unlocks.map((u) => [u.id, u]));
  const group = encounter.exclusiveGroupId
    ? view.groupsByDex.get(encounter.dex)?.find((g) => g.id === encounter.exclusiveGroupId)
    : undefined;

  return {
    key: `${subAreaId}:${encounter.method}:${encounter.dex}:${encounter.label ?? ''}`,
    dex: encounter.dex,
    name: species?.name ?? `#${encounter.dex}`,
    types: species?.types ?? [],
    slots: encounter.slots,
    requires: (encounter.requires ?? []).map((id) => unlockById.get(id)?.label ?? id),
    exclusiveGroupLabel: group?.label,
    trade: encounter.trade && {
      giveDex: encounter.trade.giveDex,
      giveName:
        view.speciesByDex.get(encounter.trade.giveDex)?.name ?? `#${encounter.trade.giveDex}`,
      giveObtainable: obtainable.has(encounter.trade.giveDex),
      ...(encounter.trade.nickname === undefined ? {} : { nickname: encounter.trade.nickname }),
    },
    ...(encounter.label === undefined ? {} : { label: encounter.label }),
    ...(encounter.note === undefined ? {} : { note: encounter.note }),
    catchRate: catchRateFor(species, game, encounter.slots[0]),
  };
}

export interface LocationInput {
  view: GameView;
  game: GameId;
  locationId: string;
  /** Species obtainable in this game, so a trade can warn about what you must give. */
  obtainable: ReadonlySet<number>;
}

/** Everything the location page shows, or `undefined` when the location is not in this game. */
export function buildLocationView(input: LocationInput): LocationView | undefined {
  const { view, game, locationId, obtainable } = input;
  const location = view.locationById.get(locationId);
  if (!location) return undefined;

  const subAreas: LocationSubArea[] = encountersFor(location, game).map((subArea) => ({
    id: subArea.id,
    name: subArea.name,
    sections: subArea.sections.map((section) => ({
      method: section.method,
      rows: section.encounters
        .map((encounter) => buildRow(encounter, subArea.id, view, game, obtainable))
        .sort(compareRows),
    })),
  }));

  const order = view.locations.findIndex((l) => l.id === locationId);
  const neighbour = (index: number) => {
    const found = view.locations[index];
    return found ? { id: found.id, name: found.name } : undefined;
  };

  const dexes = [
    ...new Set(subAreas.flatMap((s) => s.sections.flatMap((x) => x.rows.map((r) => r.dex)))),
  ];

  return {
    location,
    part: location.placement[game]?.part ?? 0,
    subAreas,
    items: location.items.filter((item) => item.games.includes(game)),
    previous: neighbour(order - 1),
    next: neighbour(order + 1),
    dexes,
  };
}

const OBTAIN_LABELS: Record<LocationItem['obtain'], string> = {
  pickup: 'Pickup',
  gift: 'Gift',
  reward: 'Reward',
  drop: 'Drop',
  choice: 'Choice',
  purchase: 'Purchase',
};

export interface ItemRow {
  item: LocationItem;
  taken: boolean;
  /** The option taken instead, for an item in a choice group (plan §13.5, Phase 9). */
  chosenInstead?: string;
}

export interface ItemFilters {
  showHidden: boolean;
  /** "Hide items I have": also hides choice options you passed on. */
  hideTaken: boolean;
}

/** The item rows shown, in page order, with each one's picked-up state. */
export function buildItemRows(
  items: readonly LocationItem[],
  taken: ReadonlySet<number>,
  filters: ItemFilters,
): ItemRow[] {
  const rows: ItemRow[] = [];
  for (const item of items) {
    if (!filters.showHidden && item.hidden) continue;
    const other = chosenInstead(item, items, taken);
    const row: ItemRow = {
      item,
      taken: taken.has(item.no),
      ...(other ? { chosenInstead: other } : {}),
    };
    if (filters.hideTaken && (row.taken || row.chosenInstead)) continue;
    rows.push(row);
  }
  return rows;
}

export function itemObtainLabel(item: LocationItem): string {
  return OBTAIN_LABELS[item.obtain];
}

/** `Cut` · `Cut or Surf`, one chip per AND term (plan §7.13). */
export function itemRequirementLabels(
  item: LocationItem,
  unlockLabel: (id: string) => string,
): string[] {
  return (item.requires ?? []).map((alternatives) => alternatives.map(unlockLabel).join(' or '));
}
