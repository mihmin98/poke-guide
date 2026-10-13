import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GameDataService } from '../../core/data/game-data.service';
import type { EncounterSlot, GameId, LocationItem, Milestone } from '../../core/domain/models';
import { TIMES_OF_DAY, timeOfDayHours, timeOfDayLabel } from '../../core/games/conditions';
import { findGame, regionName } from '../../core/games/registry';
import { mechanicsForGame } from '../../core/mechanics';
import { ProfileStore } from '../../core/profiles/profile.store';
import { UndoSnackbarService } from '../../core/profiles/undo-snackbar.service';
import { SettingsStore } from '../../core/settings/settings.store';
import { itemProgress } from '../../core/domain/item-progress';
import { milestoneProgress } from '../../core/domain/milestone-progress';
import { CatchToggle } from '../../shared/components/catch-toggle';
import { ConditionChips } from '../../shared/components/condition-chips';
import { GameMismatchBanner } from '../../shared/components/game-mismatch-banner';
import { ItemToggle } from '../../shared/components/item-toggle';
import { MilestoneRow } from '../../shared/components/milestone-row';
import { LevelRange } from '../../shared/components/level-range';
import { MethodIcon } from '../../shared/components/method-icon';
import { formatRate, RateDisplay } from '../../shared/components/rate';
import { Sprite } from '../../shared/components/sprite';
import { TypeBadge } from '../../shared/components/type-badge';
import { pageTitle } from '../../shared/page-title';
import { onHorizontalSwipe, type SwipeDirection } from '../../shared/swipe';
import { ConfirmDialog, type ConfirmDialogData } from '../profiles/profile-dialogs';
import {
  buildItemRows,
  buildLocationView,
  catchDifficulty,
  itemObtainLabel,
  itemRequirementLabels,
  type LocationRow,
  type LocationSubArea,
} from './location-model';

const ALL_SUB_AREAS = '__all__';

/** `/:game/guide/:locationId` (plan §13.5): what you can catch here, and the items found here. */
@Component({
  selector: 'app-location-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    CatchToggle,
    ConditionChips,
    GameMismatchBanner,
    ItemToggle,
    MilestoneRow,
    LevelRange,
    MethodIcon,
    RateDisplay,
    Sprite,
    TypeBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <header class="head">
        <a class="back" [routerLink]="['/', game(), 'guide']">
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
          Guide
        </a>
        <h1>{{ v.location.name }}</h1>
        <p class="meta">
          <span>{{ region(v.location.region) }}</span>
          <span>· Part {{ v.part }}</span>
          <a [href]="sourceUrl(v.location.source)" rel="noopener" target="_blank">
            Source: Bulbapedia ↗
          </a>
        </p>
        @for (note of v.location.notes; track note) {
          <p class="note">{{ note }}</p>
        }
      </header>

      <app-game-mismatch-banner [game]="gameId()" />

      @if (v.subAreas.length > 1) {
        <div class="tabs" role="tablist" aria-label="Areas">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="subArea() === all"
            (click)="subArea.set(all)"
          >
            All
          </button>
          @for (area of v.subAreas; track area.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="subArea() === area.id"
              (click)="subArea.set(area.id)"
            >
              {{ area.name ?? 'Main area' }}
            </button>
          }
        </div>
      }

      <div class="actions">
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="onlyMissing()"
          (click)="onlyMissing.set(!onlyMissing())"
        >
          Show only missing
        </button>
        <button
          matButton
          type="button"
          [disabled]="!canEdit() || v.dexes.length === 0"
          (click)="markAll(v.dexes)"
        >
          Mark all here as caught
        </button>
      </div>

      @for (area of shownSubAreas(); track area.id) {
        <section class="area">
          @if (area.name && v.subAreas.length > 1) {
            <h2>{{ area.name }}</h2>
          }

          @for (section of area.sections; track section.method.id) {
            @if (rowsOf(section.rows).length) {
              @if (area.name && v.subAreas.length > 1) {
                <h3 class="method">
                  <app-method-icon [method]="section.method.id" [showLabel]="true" />
                </h3>
              } @else {
                <h2 class="method">
                  <app-method-icon [method]="section.method.id" [showLabel]="true" />
                </h2>
              }

              <ul
                class="rows"
                [class.compact]="compact()"
                [class.timed]="section.timeColumns && showRates()"
              >
                @if (section.timeColumns && showRates()) {
                  <li class="row time-head" aria-hidden="true">
                    <span class="slots">
                      <span class="slot">
                        @for (time of times; track time) {
                          <span class="tcell" [title]="timeHours(time)">{{ timeLabel(time) }}</span>
                        }
                      </span>
                    </span>
                    @if (showCatchRates()) {
                      <span class="cr placeholder">CR 255</span>
                    }
                  </li>
                }
                @for (row of rowsOf(section.rows); track row.key) {
                  <li class="row">
                    <app-catch-toggle [dex]="row.dex" [game]="gameId()" [name]="row.name" />
                    <app-sprite
                      [dex]="row.dex"
                      [game]="gameId()"
                      [name]="row.name"
                      [size]="spriteSize()"
                    />

                    <span class="who">
                      <span class="name">
                        <span class="dex">#{{ pad(row.dex) }}</span>
                        {{ row.name }}
                      </span>
                      <span class="types">
                        @for (type of row.types; track type) {
                          <app-type-badge [type]="type" />
                        }
                      </span>
                      @if (row.label) {
                        <span class="label">{{ row.label }}</span>
                      }
                    </span>

                    <span class="slots">
                      @for (line of row.lines; track $index) {
                        <span class="slot">
                          <app-condition-chips [conditions]="line.conditions" />
                          @if (line.shiny === 'guaranteed') {
                            <span class="badge">Guaranteed shiny</span>
                          } @else if (line.shiny === 'locked') {
                            <span class="badge">Shiny-locked</span>
                          }
                          @if (line.ivs) {
                            <span class="badge" [title]="ivsText(line.ivs)"
                              >Fixed {{ ivLabel() }}s</span
                            >
                          }
                          <app-level-range [levels]="line.levels" />
                          @if (showRates()) {
                            @if (line.byTime; as byTime) {
                              @for (time of times; track time) {
                                <span class="tcell">
                                  <span class="sr-only">{{ timeLabel(time) }}:</span>
                                  @if (byTime[time]; as rate) {
                                    {{ rateText(rate) }}
                                  } @else {
                                    <span aria-hidden="true">—</span>
                                    <span class="sr-only">none</span>
                                  }
                                </span>
                              }
                            } @else if (line.rate; as rate) {
                              @if (section.timeColumns) {
                                <span class="tcell all">
                                  @if (line.allDay) {
                                    <span class="sr-only">Any time:</span>
                                  }
                                  <app-rate [rate]="rate" />
                                </span>
                              } @else {
                                <app-rate [rate]="rate" />
                              }
                            }
                          }
                        </span>
                      }
                    </span>

                    @if (showCatchRates() && row.catchRate !== undefined) {
                      <a
                        class="cr"
                        [class]="'cr-' + difficulty(row.catchRate)"
                        [routerLink]="['/', game(), 'tools', 'catch']"
                        [queryParams]="{ dex: row.dex, level: minLevel(row) }"
                        [title]="'Catch chance for ' + row.name"
                      >
                        CR {{ row.catchRate }}
                      </a>
                    }

                    <span class="tags">
                      @for (requirement of row.requires; track requirement) {
                        <span class="badge lock">
                          <mat-icon aria-hidden="true">lock</mat-icon>
                          {{ requirement }}
                        </span>
                      }
                      @if (row.exclusiveGroupLabel; as group) {
                        <span class="badge">Choose one: {{ group }}</span>
                      }
                    </span>

                    @if (row.trade; as trade) {
                      <p class="trade">
                        Give <strong>{{ trade.giveName }}</strong> → get
                        <strong>{{ row.name }}</strong>
                        @if (trade.nickname) {
                          (“{{ trade.nickname }}”)
                        }
                        @if (!trade.giveObtainable) {
                          <span class="warn">
                            You can't get {{ trade.giveName }} in this game without trading.
                          </span>
                        }
                      </p>
                    }

                    @if (row.note) {
                      <p class="note">{{ row.note }}</p>
                    }
                  </li>
                }
              </ul>
            }
          } @empty {
            <p class="status">No wild Pokémon in this area.</p>
          }
        </section>
      }

      @if (v.subAreas.length === 0) {
        <p class="status">No Pokémon can be caught here in {{ gameName() }}.</p>
      }

      @if (milestones().length) {
        <section class="story">
          <h2>
            Story
            <span class="count">{{ milestoneCount().done }}/{{ milestoneCount().total }}</span>
          </h2>
          <ul class="rows">
            @for (milestone of milestones(); track milestone.no) {
              <li>
                <app-milestone-row
                  [milestone]="milestone"
                  [game]="gameId()"
                  [species]="speciesOf(milestone)"
                  [done]="milestonesDone().has(milestone.no)"
                />
              </li>
            }
          </ul>
        </section>
      }

      @if (v.items.length || v.itemNotes.length) {
        <section class="items">
          <h2>
            Items
            @if (itemCount().total) {
              <span class="count">{{ itemCount().taken }}/{{ itemCount().total }}</span>
            }
          </h2>
          <div class="actions">
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="showHidden()"
              (click)="showHidden.set(!showHidden())"
            >
              Show hidden items
            </button>
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="hideTaken()"
              (click)="hideTaken.set(!hideTaken())"
            >
              Hide items I have
            </button>
          </div>

          <ul class="rows" [class.compact]="compact()">
            @for (row of items(); track row.item.no) {
              @let item = row.item;
              <li class="row item" [class.taken]="row.taken || row.chosenInstead">
                <app-item-toggle
                  [no]="item.no"
                  [game]="gameId()"
                  [name]="item.name"
                  [chosenInstead]="row.chosenInstead"
                />
                <span class="who">
                  <span class="name">
                    {{ item.name }}
                    @if (item.quantity > 1) {
                      <span class="dex">×{{ item.quantity }}</span>
                    }
                  </span>
                  @if (item.subArea) {
                    <span class="label">{{ item.subArea }}</span>
                  }
                </span>
                <span class="tags">
                  <span class="badge">{{ obtainLabel(item) }}</span>
                  @if (item.coins) {
                    <span class="badge">{{ item.coins }} coins</span>
                  }
                  @if (item.hidden) {
                    <span class="badge">Hidden</span>
                  }
                  @for (requirement of requirements(item); track requirement) {
                    <span class="badge lock">
                      <mat-icon aria-hidden="true">lock</mat-icon>
                      {{ requirement }}
                    </span>
                  }
                  @if (fromPart(item); as part) {
                    <span class="badge">from Part {{ part }}</span>
                  }
                  @if (row.chosenInstead; as other) {
                    <span class="badge">You chose the {{ other }}</span>
                  }
                </span>
                <p class="note where">{{ item.where }}</p>
              </li>
            }
          </ul>
          @if (hideTaken() && itemCount().total && itemCount().taken === itemCount().total) {
            <p class="status">You have every item here.</p>
          }

          @for (note of v.itemNotes; track note) {
            <p class="note">{{ note }}</p>
          }
        </section>
      }

      <nav class="prev-next" aria-label="Walkthrough order">
        @if (v.previous; as previous) {
          <a matButton [routerLink]="['/', game(), 'guide', previous.id]">
            <mat-icon aria-hidden="true">chevron_left</mat-icon>
            {{ previous.name }}
          </a>
        }
        @if (v.next; as next) {
          <a matButton class="next" [routerLink]="['/', game(), 'guide', next.id]">
            {{ next.name }}
            <mat-icon aria-hidden="true">chevron_right</mat-icon>
          </a>
        }
      </nav>
    } @else if (data().isLoading()) {
      <p class="status">Loading {{ gameName() }} data…</p>
    } @else if (data().error()) {
      <p class="status error">
        The {{ gameName() }} data could not be loaded. Check your connection and reload.
      </p>
    } @else {
      <p class="status">
        This location is not in {{ gameName() }}.
        <a [routerLink]="['/', game(), 'guide']">Back to the guide</a>
      </p>
    }
  `,
  styles: `
    /* In the desktop two-pane layout the list is already on screen (plan §13.2). */
    @media (min-width: 1200px) {
      .back {
        display: none;
      }
    }
    .head h1 {
      margin: 8px 0 0;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
      text-decoration: none;
    }
    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .note {
      margin: 8px 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 16px 0 8px;
      overflow-x: auto;
    }
    .tabs button {
      min-height: 40px;
      padding: 0 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 20px;
      background: none;
      color: inherit;
      font: var(--mat-sys-label-large);
      cursor: pointer;
      white-space: nowrap;
    }
    .tabs button[aria-selected='true'] {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      border-color: transparent;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin: 8px 0 16px;
    }
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 24px 0 8px;
    }
    .method {
      margin: 16px 0 8px;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .row {
      display: grid;
      grid-template-columns: auto auto 1fr auto auto;
      grid-template-areas:
        'toggle sprite who slots cr'
        'toggle sprite tags tags tags'
        'trade trade trade trade trade'
        'note note note note note';
      align-items: center;
      gap: 4px 12px;
      padding: 4px 8px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    .rows.compact {
      gap: 2px;
    }
    /* Morning / Day / Night columns (games with time of day): fixed-width cells at the row's end line up. */
    .tcell {
      width: 3.25em;
      text-align: end;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .tcell.all {
      width: calc(3 * 3.25em + 16px);
      text-align: center;
    }
    .time-head {
      grid-template-areas: 'toggle sprite who slots cr';
      background: none;
      padding-block: 0;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .rows.timed .cr {
      min-width: 3.75em;
      text-align: end;
    }
    .cr.placeholder {
      visibility: hidden;
    }
    @media (max-width: 599px) {
      .rows.timed .row {
        grid-template-areas:
          'toggle sprite who who cr'
          'toggle sprite slots slots slots'
          'toggle sprite tags tags tags'
          'trade trade trade trade trade'
          'note note note note note';
      }
      .rows.timed .time-head {
        grid-template-areas: 'slots slots slots slots slots';
      }
      .rows.timed .time-head .cr {
        display: none;
      }
    }
    .rows.compact .row {
      padding: 0 8px;
      gap: 0 8px;
    }
    app-catch-toggle {
      grid-area: toggle;
    }
    app-sprite {
      grid-area: sprite;
    }
    .who {
      grid-area: who;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .slots {
      grid-area: slots;
      display: grid;
      gap: 2px;
      justify-items: end;
    }
    .slot {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cr {
      grid-area: cr;
      font: var(--mat-sys-label-medium);
      font-variant-numeric: tabular-nums;
      color: inherit;
      text-decoration-style: dotted;
      white-space: nowrap;
    }
    .cr-easy {
      color: var(--mat-sys-primary);
    }
    .cr-hard {
      color: var(--mat-sys-error);
    }
    .tags {
      grid-area: tags;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tags:empty {
      display: none;
    }
    .trade {
      grid-area: trade;
      margin: 0;
      font: var(--mat-sys-body-small);
    }
    .row .note {
      grid-area: note;
      margin: 0;
    }
    .name {
      font: var(--mat-sys-body-large);
    }
    .dex {
      color: var(--mat-sys-on-surface-variant);
      font-variant-numeric: tabular-nums;
    }
    .types {
      display: flex;
      gap: 4px;
    }
    .label {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    .badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .warn {
      color: var(--mat-sys-error);
    }
    .item {
      grid-template-columns: auto 1fr auto;
      grid-template-areas:
        'kind who tags'
        'note note note';
    }
    .item app-item-toggle {
      grid-area: kind;
    }
    .item.taken .name {
      color: var(--mat-sys-on-surface-variant);
    }
    h2 .count {
      margin-left: 8px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      font-variant-numeric: tabular-nums;
    }
    .where {
      grid-area: note;
    }
    .status {
      color: var(--mat-sys-on-surface-variant);
    }
    .status.error {
      color: var(--mat-sys-error);
    }
    .prev-next {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 24px 0;
    }
    .prev-next .next {
      margin-left: auto;
    }
  `,
})
export class LocationPage {
  private readonly gameData = inject(GameDataService);
  private readonly profiles = inject(ProfileStore);
  private readonly settings = inject(SettingsStore);
  private readonly dialog = inject(MatDialog);
  private readonly undoSnackbar = inject(UndoSnackbarService);
  private readonly router = inject(Router);

  /** Route params, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();
  readonly locationId = input.required<string>();

  constructor() {
    // Touch screens: swipe left for the next location in walkthrough order, right for the previous.
    onHorizontalSwipe((direction) => this.goToNeighbour(direction));
    pageTitle(() => {
      const name = this.view()?.location.name;
      return name && `${name} · ${this.gameName()}`;
    });
  }

  protected readonly all = ALL_SUB_AREAS;
  protected readonly gameId = computed(() => this.game() as GameId);
  protected readonly gameName = computed(() => findGame(this.game())?.name ?? '');
  /**
   * `forGame` creates the `httpResource` for a version group, which starts an effect, so it must not
   * run inside a reactive context (NG0602).
   */
  protected readonly data = computed(() => {
    const id = this.gameId();
    return untracked(() => this.gameData.forGame(id));
  });

  /** Resets to "All" when the route moves to another location. */
  protected readonly subArea = linkedSignal<string, string>({
    source: () => this.locationId(),
    computation: () => ALL_SUB_AREAS,
  });
  protected readonly onlyMissing = signal(false);
  protected readonly showHidden = signal(true);
  protected readonly hideTaken = signal(false);

  protected readonly showRates = this.settings.select('showRates');
  protected readonly showCatchRates = this.settings.select('showCatchRates');
  protected readonly compact = this.settings.select('compactRows');

  protected readonly times = TIMES_OF_DAY;
  protected readonly timeLabel = timeOfDayLabel;
  protected readonly timeHours = timeOfDayHours;
  protected readonly rateText = formatRate;
  /** "DV" or "IV", from the generation's rules. */
  protected readonly ivLabel = computed(
    () => mechanicsForGame(this.gameId())?.ivSystem.label ?? 'IV',
  );
  /** "Attack 14 · Defense 10 · …" for a fixed set, labelled by the generation's rules. */
  protected ivsText(ivs: EncounterSlot['ivs']): string {
    if (ivs?.kind !== 'fixed') return '';
    const labels = mechanicsForGame(this.gameId())?.statLabels ?? {};
    return Object.entries(ivs.values)
      .map(([stat, value]) => `${labels[stat] ?? stat} ${value}`)
      .join(' · ');
  }
  protected readonly spriteSize = computed(() =>
    this.settings.settings().spriteScale === 3 ? 56 : 40,
  );
  protected readonly canEdit = computed(() => this.profiles.canEditCatches(this.gameId()));

  protected readonly view = computed(() => {
    const view = this.data().view();
    if (!view) return undefined;
    const obtainable = new Set(
      this.data()
        .checklist()
        .filter((e) => e.obtainable)
        .map((e) => e.dex),
    );
    return buildLocationView({
      view,
      game: this.gameId(),
      locationId: this.locationId(),
      obtainable,
    });
  });

  /** The selected sub-area, or all of them. Resets to "All" when the location changes. */
  protected readonly shownSubAreas = computed<LocationSubArea[]>(() => {
    const areas = this.view()?.subAreas ?? [];
    const selected = this.subArea();
    if (selected === ALL_SUB_AREAS) return areas;
    const found = areas.find((a) => a.id === selected);
    return found ? [found] : areas;
  });

  private readonly itemsTaken = computed(() => this.profiles.itemsTakenIn(this.gameId()));

  /** Story milestones that happen here in this game (plan §13.12), in walkthrough order. */
  protected readonly milestones = computed(() =>
    (this.data().view()?.milestones ?? []).filter((m) => m.locationId === this.locationId()),
  );
  protected readonly milestonesDone = computed(() => this.profiles.milestonesDoneIn(this.gameId()));
  protected readonly milestoneCount = computed(() =>
    milestoneProgress(this.milestones(), this.milestonesDone()),
  );

  protected speciesOf(milestone: Milestone): { name: string; slug: string } | undefined {
    const species =
      milestone.dex === undefined ? undefined : this.data().view()?.speciesByDex.get(milestone.dex);
    return species && { name: species.name, slug: species.slug };
  }

  protected readonly items = computed(() =>
    buildItemRows(this.view()?.items ?? [], this.itemsTaken(), {
      showHidden: this.showHidden(),
      hideTaken: this.hideTaken(),
    }),
  );

  /** Over every item here, whatever the filters show. */
  protected readonly itemCount = computed(() =>
    itemProgress(this.view()?.items ?? [], this.itemsTaken()),
  );

  protected rowsOf<T extends { dex: number }>(rows: readonly T[]): T[] {
    if (!this.onlyMissing()) return [...rows];
    const caught = this.profiles.caughtSet();
    return rows.filter((row) => !caught.has(row.dex));
  }

  protected region = regionName;
  protected obtainLabel = itemObtainLabel;
  protected difficulty = catchDifficulty;

  /** The lowest level the row can appear at, so the calculator opens with a sensible HP estimate. */
  protected minLevel(row: LocationRow): number {
    const levels = row.slots
      .map((slot) => slot.levels?.min)
      .filter((level): level is number => level !== undefined);
    return levels.length ? Math.min(...levels) : 5;
  }

  protected pad(dex: number): string {
    return String(dex).padStart(3, '0');
  }

  protected sourceUrl(source: { title: string; revid: number }): string {
    const title = encodeURIComponent(source.title.replace(/ /g, '_'));
    return `https://bulbapedia.bulbagarden.net/w/index.php?title=${title}&oldid=${source.revid}`;
  }

  protected requirements(item: LocationItem): string[] {
    const unlocks = new Map((this.data().view()?.unlocks ?? []).map((u) => [u.id, u.label]));
    return itemRequirementLabels(item, (id) => unlocks.get(id) ?? id);
  }

  protected fromPart(item: LocationItem): number | undefined {
    return item.fromPart?.[this.gameId()];
  }

  protected async markAll(dexes: readonly number[]): Promise<void> {
    const data: ConfirmDialogData = {
      title: 'Mark everything here as caught?',
      message: `This marks ${dexes.length} Pokémon as caught in your active profile. You can undo it right after.`,
      confirmLabel: 'Mark as caught',
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
      true,
      `Marked ${dexes.length} Pokémon at ${this.view()?.location.name ?? 'this location'} as caught`,
    );
    void this.undoSnackbar.show();
  }

  private goToNeighbour(direction: SwipeDirection): void {
    const view = this.view();
    const target = direction === 'left' ? view?.next : view?.previous;
    if (target) void this.router.navigate(['/', this.game(), 'guide', target.id]);
  }
}
