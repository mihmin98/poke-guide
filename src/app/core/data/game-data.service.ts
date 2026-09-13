import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable, Injector, computed, inject, runInInjectionContext, type Signal } from '@angular/core';
import { buildGameView, encountersFor, type GameView, type SubAreaEncounters } from '../domain/game-view';
import type { GameId, PokedexData, VersionGroupData, VersionGroupId } from '../domain/models';
import { buildChecklist, maxInOneSave, type ChecklistEntry } from '../domain/obtainability';
import { getGame, versionGroupOf } from '../games/registry';
import type { GameDefinition } from '../games/types';

/** Relative so the app works under the GitHub Pages base href (plan §17). */
export const dataUrl = (group: VersionGroupId) => `data/${group}.json`;
export const pokedexUrl = (group: VersionGroupId) => `data/${group}.pokedex.json`;

/** Rejects a file for another version group or schema (e.g. a stale service-worker copy). */
function checked<T extends { schemaVersion: number; versionGroupId: string }>(group: VersionGroupId) {
  return (raw: unknown): T => {
    const file = raw as T;
    if (file?.schemaVersion !== 1 || file.versionGroupId !== group) {
      throw new Error(`Unexpected data file for ${group} (schema ${String(file?.schemaVersion)})`);
    }
    return file;
  };
}

/** One game's data, as signals. Everything is empty (`[]`, empty maps, `undefined`) until the file has loaded. */
export class GameDataView {
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<unknown>;
  readonly data: Signal<VersionGroupData | undefined>;
  /** Indexes for this game; `undefined` until loaded. */
  readonly view: Signal<GameView | undefined>;
  readonly species = computed(() => this.view()?.species ?? []);
  readonly speciesByDex = computed(() => this.view()?.speciesByDex ?? new Map());
  readonly speciesBySlug = computed(() => this.view()?.speciesBySlug ?? new Map());
  readonly locations = computed(() => this.view()?.locations ?? []);
  readonly locationById = computed(() => this.view()?.locationById ?? new Map());
  readonly evolutionsFrom = computed(() => this.view()?.evolutionsFrom ?? new Map());
  readonly evolutionsTo = computed(() => this.view()?.evolutionsTo ?? new Map());
  readonly unlocks = computed(() => this.view()?.unlocks ?? []);
  readonly walkthrough = computed(() => this.view()?.walkthrough ?? []);
  readonly groupsByDex = computed(() => this.view()?.groupsByDex ?? new Map());
  /** Obtainability per species `1..nationalDexMax` (plan §9), computed once per loaded file. */
  readonly checklist: Signal<readonly ChecklistEntry[]>;
  readonly maxInOneSave: Signal<number | undefined>;

  constructor(
    readonly game: GameDefinition,
    resource: HttpResourceRef<VersionGroupData | undefined>,
    private readonly loadPokedex: () => HttpResourceRef<PokedexData | undefined>,
  ) {
    const features = versionGroupOf(game).features;
    this.isLoading = resource.isLoading;
    this.error = resource.error;
    this.data = computed(() => (resource.hasValue() ? resource.value() : undefined));
    this.view = computed(() => {
      const data = this.data();
      return data && buildGameView(data, game.id);
    });
    this.checklist = computed(() => {
      const data = this.data();
      return data ? buildChecklist(data, game, features) : [];
    });
    this.maxInOneSave = computed(() => {
      const data = this.data();
      return data && maxInOneSave(data, game, features, this.checklist());
    });
  }

  /** The Pokédex file (moves, learnsets, entries). Only requested the first time this is called. */
  pokedex(): HttpResourceRef<PokedexData | undefined> {
    return this.loadPokedex();
  }

  /** A location's encounters in this game, by sub-area and method section; empty for unknown locations. */
  encountersFor(locationId: string): SubAreaEncounters[] {
    const location = this.locationById().get(locationId);
    return location ? encountersFor(location, this.game.id) : [];
  }
}

/**
 * Loads version-group data lazily (plan §11.4): one `httpResource` per version group, so Red, Blue and
 * Yellow share a single request for `data/rby.json`. The Pokédex file is a separate, on-demand request.
 */
@Injectable({ providedIn: 'root' })
export class GameDataService {
  private readonly injector = inject(Injector);
  private readonly dataFiles = new Map<VersionGroupId, HttpResourceRef<VersionGroupData | undefined>>();
  private readonly pokedexFiles = new Map<VersionGroupId, HttpResourceRef<PokedexData | undefined>>();
  private readonly views = new Map<GameId, GameDataView>();

  forGame(gameId: GameId): GameDataView {
    let view = this.views.get(gameId);
    if (!view) {
      const game = getGame(gameId);
      const group = game.versionGroupId;
      view = new GameDataView(game, this.dataFile(group), () => this.pokedexFile(group));
      this.views.set(gameId, view);
    }
    return view;
  }

  private dataFile(group: VersionGroupId): HttpResourceRef<VersionGroupData | undefined> {
    let ref = this.dataFiles.get(group);
    if (!ref) {
      ref = runInInjectionContext(this.injector, () =>
        httpResource(() => dataUrl(group), { parse: checked<VersionGroupData>(group) }),
      );
      this.dataFiles.set(group, ref);
    }
    return ref;
  }

  private pokedexFile(group: VersionGroupId): HttpResourceRef<PokedexData | undefined> {
    let ref = this.pokedexFiles.get(group);
    if (!ref) {
      ref = runInInjectionContext(this.injector, () =>
        httpResource(() => pokedexUrl(group), { parse: checked<PokedexData>(group) }),
      );
      this.pokedexFiles.set(group, ref);
    }
    return ref;
  }
}
