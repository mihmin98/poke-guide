import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GameDataService } from '../../core/data/game-data.service';
import type { GameId, PokemonType } from '../../core/domain/models';
import { findGame } from '../../core/games/registry';
import { ProfileStore } from '../../core/profiles/profile.store';
import { UndoSnackbarService } from '../../core/profiles/undo-snackbar.service';
import { SettingsStore } from '../../core/settings/settings.store';
import { CatchToggle } from '../../shared/components/catch-toggle';
import { GameMismatchBanner } from '../../shared/components/game-mismatch-banner';
import { ProgressRing } from '../../shared/components/progress-ring';
import { Sprite } from '../../shared/components/sprite';
import { TypeBadge } from '../../shared/components/type-badge';
import { columnCount, gridMove } from '../../shared/roving-grid';
import { ConfirmDialog, type ConfirmDialogData } from '../profiles/profile-dialogs';
import {
  buildChecklistView,
  obtainCategoryLabel,
  unobtainableLabel,
  type ChecklistRow,
  type ChecklistSort,
  type ChecklistStatus,
  type ObtainCategory,
} from './checklist-model';

const STATUSES: readonly { id: ChecklistStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'missing', label: 'Missing' },
  { id: 'caught', label: 'Caught' },
];

/** `/:game/checklist` (plan §13.6): every species, with filters, sorts and the two views. */
@Component({
  selector: 'app-checklist-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    CatchToggle,
    GameMismatchBanner,
    ProgressRing,
    Sprite,
    TypeBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <h1>{{ gameName() }} checklist</h1>
        <p class="sub">Every Pokémon you can get without trading with another player.</p>
      </div>
      <app-progress-ring
        [value]="view().summary.caught"
        [total]="view().summary.obtainable"
        label="obtainable without trading"
      />
    </header>

    <app-game-mismatch-banner [game]="gameId()" />

    <section class="summary card">
      <p class="headline">
        Caught <strong>{{ view().summary.caught }}</strong> /
        {{ view().summary.obtainable }} obtainable without trading
      </p>
      @if (view().summary.maxInOneSave; as max) {
        <p class="sub">Max in one save: {{ max }} — exclusive choices can't all be made once.</p>
      }
      @if (view().summary.caughtExtra; as extra) {
        <p class="sub">
          {{ extra }} caught {{ extra === 1 ? 'species is' : 'species are' }} not obtainable in
          {{ gameName() }} — traded in from another game.
        </p>
      }

      <label class="progress-part">
        <span>I'm on</span>
        <select
          [value]="progressPart() ?? ''"
          [disabled]="!canEdit()"
          (change)="onProgressPart($event)"
        >
          <option value="">no particular part</option>
          @for (part of walkthrough(); track part.part) {
            <option [value]="part.part">Part {{ part.part }} · {{ part.title }}</option>
          }
        </select>
      </label>

      @if (view().summary.byType.length) {
        <details>
          <summary>Progress by type</summary>
          <ul class="types">
            @for (entry of view().summary.byType; track entry.type) {
              <li>
                <app-type-badge [type]="entry.type" />
                <span class="bar" aria-hidden="true">
                  <span [style.width.%]="percent(entry.caught, entry.total)"></span>
                </span>
                <span class="count">{{ entry.caught }}/{{ entry.total }}</span>
              </li>
            }
          </ul>
        </details>
      }
    </section>

    <div class="controls" role="search">
      <label class="search">
        <mat-icon aria-hidden="true">search</mat-icon>
        <input
          type="search"
          placeholder="Search by name or #025"
          aria-label="Search by name or number"
          [value]="search()"
          (input)="onSearch($event)"
        />
      </label>

      <div class="toggles" role="group" aria-label="Status">
        @for (option of statuses; track option.id) {
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="status() === option.id"
            (click)="status.set(option.id)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <label class="select">
        <span>Sort</span>
        <select [value]="sort()" (change)="onSort($event)">
          <option value="national">National Dex</option>
          @if (hasRegionalDex()) {
            <option value="regional">Regional Dex</option>
          }
          <option value="walkthrough">Walkthrough</option>
        </select>
      </label>

      <div class="toggles" role="group" aria-label="View">
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="mode() === 'grid'"
          (click)="mode.set('grid')"
        >
          <mat-icon aria-hidden="true">grid_view</mat-icon> Grid
        </button>
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="mode() === 'list'"
          (click)="mode.set('list')"
        >
          <mat-icon aria-hidden="true">view_list</mat-icon> List
        </button>
      </div>

      <button
        type="button"
        class="chip"
        [disabled]="progressPart() === undefined"
        [attr.aria-pressed]="onlyAvailable()"
        [title]="
          progressPart() === undefined
            ? 'Say which part you are on first'
            : 'Only species you can already get at part ' + progressPart()
        "
        (click)="onlyAvailable.set(!onlyAvailable())"
      >
        Available now
      </button>
    </div>

    @if (view().categories.length > 1) {
      <div class="toggles" role="group" aria-label="How to obtain">
        @for (category of view().categories; track category) {
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="categories().has(category)"
            (click)="toggleCategory(category)"
          >
            {{ categoryLabel(category) }}
          </button>
        }
      </div>
    }

    <div class="toggles types-filter" role="group" aria-label="Types">
      @for (type of allTypes(); track type) {
        <button
          type="button"
          class="type-chip"
          [attr.aria-pressed]="types().has(type)"
          (click)="toggleType(type)"
        >
          <app-type-badge [type]="type" />
        </button>
      }
    </div>

    @if (data().isLoading()) {
      <p class="status">Loading {{ gameName() }} data…</p>
    } @else if (data().error()) {
      <p class="status error">
        The {{ gameName() }} data could not be loaded. Check your connection and reload.
      </p>
    } @else {
      <p class="status count-line">
        Showing {{ view().rows.length }} Pokémon
        @if (canEdit() && view().rows.length) {
          <button matButton type="button" (click)="markFiltered(true)">Mark all as caught</button>
          <button matButton type="button" (click)="markFiltered(false)">Mark all as missing</button>
        }
      </p>

      @if (view().rows.length === 0) {
        <p class="status">No Pokémon matches these filters.</p>
      } @else if (mode() === 'grid') {
        <p id="grid-keys" class="sr-only">
          Arrow keys move between Pokémon, Space marks one as caught, Enter opens its details.
        </p>
        <ul class="grid" aria-describedby="grid-keys">
          @for (row of view().rows; track row.dex; let index = $index) {
            <li class="tile" [class.caught]="row.caught">
              <!-- aria-disabled rather than disabled, so the grid stays reachable by keyboard. -->
              <button
                type="button"
                role="checkbox"
                [attr.aria-checked]="row.caught"
                [attr.aria-label]="row.name + (row.caught ? ', caught' : ', not caught')"
                [attr.aria-disabled]="!canEdit()"
                [attr.tabindex]="index === activeTile() ? 0 : -1"
                (focus)="focusedTile.set(index)"
                (keydown)="onTileKey($event, index, row)"
                (click)="canEdit() && toggle(row)"
              >
                <app-sprite
                  [dex]="row.dex"
                  [game]="gameId()"
                  [dimmed]="!row.caught"
                  [size]="tileSprite()"
                />
                <span class="num">#{{ pad(row.dex) }}</span>
                <span class="name">{{ row.name }}</span>
                @if (row.caught) {
                  <mat-icon class="mark" aria-hidden="true">check_circle</mat-icon>
                }
              </button>
              <!-- Enter on the tile opens the same page, so the link is left out of the tab order. -->
              <a
                class="info"
                tabindex="-1"
                [routerLink]="['/', game(), 'pokemon', row.slug]"
                [attr.aria-label]="'Details for ' + row.name"
              >
                <mat-icon aria-hidden="true">info</mat-icon>
              </a>
            </li>
          }
        </ul>
      } @else {
        <ul class="list" [class.compact]="compact()">
          @for (row of view().rows; track row.dex) {
            <li class="row">
              <app-catch-toggle [dex]="row.dex" [game]="gameId()" [name]="row.name" />
              <app-sprite
                [dex]="row.dex"
                [game]="gameId()"
                [dimmed]="!row.caught"
                [size]="rowSprite()"
              />
              <span class="num">#{{ pad(row.dex) }}</span>
              <a class="name" [routerLink]="['/', game(), 'pokemon', row.slug]">{{ row.name }}</a>
              <span class="types">
                @for (type of row.types; track type) {
                  <app-type-badge [type]="type" />
                }
              </span>
              @if (row.earliest; as first) {
                <span class="where">
                  {{ first.label }}
                  @if (first.detail) {
                    · {{ first.detail }}
                  }
                  · Part {{ first.part }}
                </span>
              }
              <button
                type="button"
                class="expand"
                [attr.aria-expanded]="expanded().has(row.dex)"
                [attr.aria-label]="'All sources for ' + row.name"
                (click)="toggleExpanded(row.dex)"
              >
                <mat-icon aria-hidden="true">
                  {{ expanded().has(row.dex) ? 'expand_less' : 'expand_more' }}
                </mat-icon>
              </button>

              @if (expanded().has(row.dex)) {
                <ul class="sources">
                  @for (source of row.sources; track $index) {
                    <li>
                      @if (source.locationId) {
                        <a [routerLink]="['/', game(), 'guide', source.locationId]">{{
                          source.label
                        }}</a>
                      } @else {
                        {{ source.label }}
                      }
                      @if (source.detail) {
                        · {{ source.detail }}
                      }
                      · Part {{ source.part }}
                    </li>
                  }
                  @for (label of row.exclusiveGroupLabels; track label) {
                    <li class="group">Choice: {{ label }}</li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      }

      @if (view().unobtainable.length) {
        <details class="unobtainable">
          <summary>
            Not obtainable in {{ gameName() }} without trading ({{ view().unobtainable.length }})
          </summary>
          <ul class="list" [class.compact]="compact()">
            @for (row of view().unobtainable; track row.dex) {
              <li class="row">
                <app-sprite
                  [dex]="row.dex"
                  [game]="gameId()"
                  [dimmed]="true"
                  [size]="rowSprite()"
                />
                <span class="num">#{{ pad(row.dex) }}</span>
                <a class="name" [routerLink]="['/', game(), 'pokemon', row.slug]">{{ row.name }}</a>
                <span class="where">
                  @if (row.unobtainableReason) {
                    {{ reasonLabel(row.unobtainableReason) }}
                  }
                  @if (row.unobtainableDetail) {
                    · {{ row.unobtainableDetail }}
                  }
                </span>
              </li>
            }
          </ul>
        </details>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
    }
    .sub {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .card {
      margin: 16px 0;
      padding: 12px 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    .headline {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    /*
     * A <select> is as wide as its widest option ("Part 12 · Silph Co."), so it has to be allowed to
     * shrink: anything wider than the screen widens the layout viewport, which drags the fixed bottom
     * nav with it.
     */
    .progress-part,
    .select {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 100%;
      margin-top: 12px;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .select {
      margin-top: 0;
    }
    /* On a phone "I'm on" and a part title don't fit one line, so the label sits above its select. */
    @media (max-width: 599.98px) {
      .progress-part {
        display: grid;
        gap: 4px;
        justify-items: start;
      }
      .progress-part select {
        width: 100%;
      }
    }
    select {
      flex: 0 1 auto;
      min-width: 0;
      min-height: 36px;
      padding: 0 8px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
      text-overflow: ellipsis;
    }
    details summary {
      margin-top: 12px;
      cursor: pointer;
      font: var(--mat-sys-label-large);
    }
    .types {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .types li {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
    }
    .bar {
      display: block;
      height: 8px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-highest);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--mat-sys-primary);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 16px 0;
      max-width: 100%;
    }
    .toggles {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .types-filter {
      margin: 8px 0;
    }
    .type-chip {
      padding: 2px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: none;
      cursor: pointer;
      opacity: 0.55;
    }
    .type-chip[aria-pressed='true'] {
      opacity: 1;
      border-color: var(--mat-sys-on-surface);
    }
    .status {
      color: var(--mat-sys-on-surface-variant);
    }
    .status.error {
      color: var(--mat-sys-error);
    }
    .count-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
      gap: 8px;
    }
    .tile {
      position: relative;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    .tile.caught {
      background: var(--mat-sys-secondary-container);
      border-color: transparent;
    }
    .tile > button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 100%;
      padding: 8px 4px;
      border: none;
      border-radius: 12px;
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .tile [aria-disabled='true'] {
      cursor: not-allowed;
    }
    .tile .num {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .tile .name {
      font: var(--mat-sys-label-medium);
      text-align: center;
    }
    .tile .mark {
      position: absolute;
      top: 4px;
      right: 4px;
      color: var(--mat-sys-primary);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .tile .info {
      position: absolute;
      top: 2px;
      left: 2px;
      display: inline-flex;
      padding: 4px;
      color: var(--mat-sys-on-surface-variant);
    }
    .tile .info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .row {
      display: grid;
      grid-template-columns: auto auto auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 4px 8px;
      padding: 4px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .list.compact .row {
      padding: 0;
      gap: 0 8px;
    }
    .row .name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .row .num {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .row .name {
      font: var(--mat-sys-body-medium);
      color: inherit;
    }
    .row .types {
      grid-column: 2 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .row .where {
      grid-column: 1 / -1;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .expand {
      min-width: 40px;
      min-height: 40px;
      border: none;
      background: none;
      color: var(--mat-sys-on-surface-variant);
      cursor: pointer;
    }
    .sources {
      grid-column: 1 / -1;
      margin: 4px 0 8px;
      padding-left: 20px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .unobtainable {
      margin-top: 24px;
    }
    @media (min-width: 720px) {
      .row {
        grid-template-columns: auto auto auto minmax(0, 1fr) auto auto;
      }
      .row .types {
        grid-column: auto;
      }
      .row .where {
        grid-column: auto;
        text-align: right;
      }
    }
  `,
})
export class ChecklistPage {
  private readonly gameData = inject(GameDataService);
  private readonly profiles = inject(ProfileStore);
  private readonly settings = inject(SettingsStore);
  private readonly dialog = inject(MatDialog);
  private readonly undoSnackbar = inject(UndoSnackbarService);
  private readonly router = inject(Router);

  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();

  protected readonly statuses = STATUSES;
  protected readonly gameId = computed(() => this.game() as GameId);
  protected readonly definition = computed(() => findGame(this.game()));
  protected readonly gameName = computed(() => this.definition()?.name ?? '');
  /**
   * `forGame` creates the `httpResource` for a version group, which starts an effect, so it must not
   * run inside a reactive context (NG0602).
   */
  protected readonly data = computed(() => {
    const id = this.gameId();
    return untracked(() => this.gameData.forGame(id));
  });

  protected readonly search = signal('');
  protected readonly status = signal<ChecklistStatus>('all');
  protected readonly types = signal<ReadonlySet<PokemonType>>(new Set());
  protected readonly categories = signal<ReadonlySet<ObtainCategory>>(new Set());
  protected readonly onlyAvailable = signal(false);
  protected readonly mode = signal<'grid' | 'list'>('grid');
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());
  /** The grid's single tab stop; clamped when filters shorten the list. */
  protected readonly focusedTile = signal(0);
  protected readonly activeTile = computed(() =>
    Math.max(0, Math.min(this.focusedTile(), this.view().rows.length - 1)),
  );

  /** The sort is a global setting, so it survives navigation and reloads. */
  protected readonly sort = this.settings.select('checklistSort');
  protected readonly compact = this.settings.select('compactRows');
  protected readonly tileSprite = computed(() =>
    this.settings.settings().spriteScale === 3 ? 72 : 56,
  );
  protected readonly rowSprite = computed(() =>
    this.settings.settings().spriteScale === 3 ? 56 : 40,
  );
  protected readonly canEdit = computed(() => this.profiles.canEditCatches(this.gameId()));
  protected readonly walkthrough = computed(() => this.data().view()?.walkthrough ?? []);
  protected readonly allTypes = computed(() => this.data().data()?.types ?? []);
  protected readonly hasRegionalDex = computed(() =>
    this.data()
      .species()
      .some((species) => species.regionalDex?.[this.gameId()] !== undefined),
  );

  /** Only the active profile's progress counts, and only when it is for this game (plan §11.4). */
  protected readonly progressPart = computed(() => {
    const profile = this.profiles.activeProfile();
    return profile?.game === this.gameId() ? profile.progressPart : undefined;
  });

  protected readonly view = computed(() => {
    const view = this.data().view();
    const empty = {
      rows: [],
      unobtainable: [],
      categories: [],
      filteredDexes: [],
      summary: {
        caught: 0,
        obtainable: 0,
        caughtExtra: 0,
        maxInOneSave: undefined,
        byType: [],
      },
    };
    if (!view) return empty;
    const caught = this.canEdit() ? this.profiles.caughtSet() : new Set<number>();
    return buildChecklistView({
      view,
      game: this.gameId(),
      entries: this.data().checklist(),
      caught,
      ...(this.progressPart() === undefined ? {} : { progressPart: this.progressPart() }),
      ...(this.data().maxInOneSave() === undefined
        ? {}
        : { maxInOneSave: this.data().maxInOneSave() }),
      filters: {
        status: this.status(),
        search: this.search(),
        types: this.types(),
        categories: this.categories(),
        onlyAvailable: this.onlyAvailable(),
        sort: this.sort(),
      },
    });
  });

  protected categoryLabel = obtainCategoryLabel;
  protected reasonLabel = unobtainableLabel;

  protected pad(dex: number): string {
    return String(dex).padStart(3, '0');
  }

  protected percent(caught: number, total: number): number {
    return total > 0 ? Math.round((caught / total) * 100) : 0;
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.settings.set('checklistSort', (event.target as HTMLSelectElement).value as ChecklistSort);
  }

  protected onProgressPart(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.profiles.setProgressPart(value === '' ? undefined : Number(value));
  }

  protected toggleType(type: PokemonType): void {
    const next = new Set(this.types());
    if (!next.delete(type)) next.add(type);
    this.types.set(next);
  }

  protected toggleCategory(category: ObtainCategory): void {
    const next = new Set(this.categories());
    if (!next.delete(category)) next.add(category);
    this.categories.set(next);
  }

  protected toggleExpanded(dex: number): void {
    const next = new Set(this.expanded());
    if (!next.delete(dex)) next.add(dex);
    this.expanded.set(next);
  }

  protected onTileKey(event: KeyboardEvent, index: number, row: ChecklistRow): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.router.navigate(['/', this.game(), 'pokemon', row.slug]);
      return;
    }
    const grid = (event.currentTarget as HTMLElement).closest('ul');
    const tiles = [...(grid?.querySelectorAll<HTMLElement>(':scope > li > button') ?? [])];
    const next = gridMove(event.key, index, tiles.length, columnCount(tiles));
    if (next === null) return;
    event.preventDefault();
    this.focusedTile.set(next);
    tiles[next]?.focus();
  }

  protected toggle(row: ChecklistRow): void {
    this.profiles.setCaught(
      this.gameId(),
      row.dex,
      !row.caught,
      `${row.caught ? 'Uncaught' : 'Caught'} ${row.name}`,
    );
  }

  /** Bulk action over exactly what the filters show, so "Missing · Part 5" can be ticked in one go. */
  protected async markFiltered(caught: boolean): Promise<void> {
    const dexes = this.view().filteredDexes;
    if (dexes.length === 0) return;
    const data: ConfirmDialogData = {
      title: caught ? 'Mark these as caught?' : 'Mark these as missing?',
      message: `This changes ${dexes.length} Pokémon — everything the filters currently show. You can undo it right after.`,
      confirmLabel: caught ? 'Mark as caught' : 'Mark as missing',
    };
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, true>(ConfirmDialog, { data })
        .afterClosed(),
    );
    if (!confirmed) return;
    this.profiles.bulkSetCaught(
      this.gameId(),
      dexes,
      caught,
      `Marked ${dexes.length} Pokémon as ${caught ? 'caught' : 'missing'}`,
    );
    void this.undoSnackbar.show();
  }
}
