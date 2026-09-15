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
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GameDataService } from '../../core/data/game-data.service';
import type { GameId, LocationItem } from '../../core/domain/models';
import { findGame, regionName } from '../../core/games/registry';
import { ProfileStore } from '../../core/profiles/profile.store';
import { UndoSnackbarService } from '../../core/profiles/undo-snackbar.service';
import { SettingsStore } from '../../core/settings/settings.store';
import { CatchToggle } from '../../shared/components/catch-toggle';
import { ConditionChips } from '../../shared/components/condition-chips';
import { GameMismatchBanner } from '../../shared/components/game-mismatch-banner';
import { LevelRange } from '../../shared/components/level-range';
import { MethodIcon } from '../../shared/components/method-icon';
import { RateDisplay } from '../../shared/components/rate';
import { Sprite } from '../../shared/components/sprite';
import { TypeBadge } from '../../shared/components/type-badge';
import { ConfirmDialog, type ConfirmDialogData } from '../profiles/profile-dialogs';
import {
  buildLocationView,
  catchDifficulty,
  itemObtainLabel,
  itemRequirementLabels,
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
              <h3 class="method">
                <app-method-icon [method]="section.method.id" [showLabel]="true" />
              </h3>

              <ul class="rows">
                @for (row of rowsOf(section.rows); track row.key) {
                  <li class="row">
                    <app-catch-toggle [dex]="row.dex" [game]="gameId()" [name]="row.name" />
                    <app-sprite [dex]="row.dex" [game]="gameId()" [name]="row.name" [size]="40" />

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
                      @for (slot of row.slots; track $index) {
                        <span class="slot">
                          <app-level-range [levels]="slot.levels" />
                          @if (showRates()) {
                            <app-rate [rate]="slot.rate" />
                          }
                          <app-condition-chips [conditions]="slot.conditions" />
                          @if (slot.shiny === 'guaranteed') {
                            <span class="badge">Guaranteed shiny</span>
                          } @else if (slot.shiny === 'locked') {
                            <span class="badge">Shiny-locked</span>
                          }
                          @if (slot.ivs) {
                            <span class="badge">Fixed IVs</span>
                          }
                        </span>
                      }
                    </span>

                    @if (showCatchRates() && row.catchRate !== undefined) {
                      <span class="cr" [class]="'cr-' + difficulty(row.catchRate)">
                        CR {{ row.catchRate }}
                      </span>
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

      @if (items().length || v.location.itemNotes.length) {
        <section class="items">
          <h2>Items</h2>
          <div class="actions">
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="showHidden()"
              (click)="showHidden.set(!showHidden())"
            >
              Show hidden items
            </button>
          </div>

          <ul class="rows">
            @for (item of items(); track $index) {
              <li class="row item">
                <mat-icon class="kind" aria-hidden="true">inventory_2</mat-icon>
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
                </span>
                <p class="note where">{{ item.where }}</p>
              </li>
            }
          </ul>

          @for (note of v.location.itemNotes; track note) {
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
    .chip {
      min-height: 32px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: none;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    .chip[aria-pressed='true'] {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      border-color: transparent;
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
    .item .kind {
      grid-area: kind;
      color: var(--mat-sys-on-surface-variant);
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

  /** Route params, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();
  readonly locationId = input.required<string>();

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

  protected readonly showRates = this.settings.select('showRates');
  protected readonly showCatchRates = this.settings.select('showCatchRates');
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

  protected readonly items = computed(() => {
    const items = this.view()?.items ?? [];
    return items.filter((item) => this.showHidden() || !item.hidden);
  });

  protected rowsOf<T extends { dex: number }>(rows: readonly T[]): T[] {
    if (!this.onlyMissing()) return [...rows];
    const caught = this.profiles.caughtSet();
    return rows.filter((row) => !caught.has(row.dex));
  }

  protected region = regionName;
  protected obtainLabel = itemObtainLabel;
  protected difficulty = catchDifficulty;

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
}
