import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterOutlet } from '@angular/router';
import { GameDataService } from '../../core/data/game-data.service';
import type { GameId } from '../../core/domain/models';
import type { EncounterMethodCategory } from '../../core/games/methods';
import { findGame, regionName } from '../../core/games/registry';
import { ProfileStore } from '../../core/profiles/profile.store';
import { CurrentGameService } from '../../core/routing/current-game.service';
import { SettingsStore } from '../../core/settings/settings.store';
import { MilestoneRow } from '../../shared/components/milestone-row';
import { ProgressRing } from '../../shared/components/progress-ring';
import { Sprite } from '../../shared/components/sprite';
import { scrollBehavior } from '../../shared/motion';
import { buildGuide, categoriesIn, categoryLabel, type GuidePart } from './guide-model';

/** `/:game/guide` (plan §13.4): every location in walkthrough order, with progress and filters. */
@Component({
  selector: 'app-guide-page',
  imports: [
    NgTemplateOutlet,
    MatIconModule,
    RouterLink,
    RouterOutlet,
    MilestoneRow,
    ProgressRing,
    Sprite,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-detail]': 'hasDetail()' },
  styleUrl: '../../shared/list-detail.scss',
  template: `
    <div class="list-pane">
      <header class="head">
        <div>
          <h1>{{ gameName() }} guide</h1>
          <p class="sub">Locations in walkthrough order.</p>
        </div>
        <app-progress-ring
          [value]="caughtObtainable()"
          [total]="obtainableTotal()"
          label="obtainable without trading"
        />
      </header>

      <div class="controls" role="search">
        <label class="search">
          <mat-icon aria-hidden="true">search</mat-icon>
          <input
            type="search"
            placeholder="Search locations and Pokémon"
            aria-label="Search locations and Pokémon"
            [value]="search()"
            (input)="onSearch($event)"
          />
        </label>

        <div class="toggles">
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="hideCompleted()"
            (click)="hideCompleted.set(!hideCompleted())"
          >
            Hide completed
          </button>
          <button
            type="button"
            class="chip"
            [disabled]="progressPart() === undefined"
            [attr.aria-pressed]="onlyAvailable()"
            [title]="
              progressPart() === undefined
                ? 'Set which part you are on in your profile first'
                : 'Only locations up to part ' + progressPart()
            "
            (click)="settings.set('hideUnavailable', !onlyAvailable())"
          >
            Only available now
          </button>
          @if (hasStory()) {
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="showStory()"
              title="Story milestones between the locations"
              (click)="settings.set('guideShowStory', !showStory())"
            >
              Show story
            </button>
          }
        </div>

        @if (categories().length > 1) {
          <div class="toggles" role="group" aria-label="Encounter types">
            @for (category of categories(); track category) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="selectedCategories().has(category)"
                (click)="toggleCategory(category)"
              >
                {{ label(category) }}
              </button>
            }
          </div>
        }
      </div>

      @if (data().isLoading()) {
        <p class="status">Loading {{ gameName() }} data…</p>
      } @else if (data().error()) {
        <p class="status error">
          The {{ gameName() }} data could not be loaded. Check your connection and reload.
        </p>
      } @else if (parts().length === 0) {
        <p class="status">No location matches these filters.</p>
      }

      @for (part of parts(); track part.part; let index = $index) {
        @if (showRegion() && part.region && part.region !== parts()[index - 1]?.region) {
          <h2 class="region">{{ region(part) }}</h2>
        }

        <section class="part" [id]="'part-' + part.part">
          <!-- Parts sit under region headings only when the game has several regions. -->
          @if (showRegion()) {
            <h3 class="part-head">
              <ng-container
                [ngTemplateOutlet]="partToggle"
                [ngTemplateOutletContext]="{ $implicit: part }"
              />
            </h3>
          } @else {
            <h2 class="part-head">
              <ng-container
                [ngTemplateOutlet]="partToggle"
                [ngTemplateOutletContext]="{ $implicit: part }"
              />
            </h2>
          }

          @if (!collapsed().has(part.part)) {
            <ul class="cards" [id]="'part-body-' + part.part">
              @for (row of part.rows; track row.key) {
                @if (row.kind === 'milestone') {
                  <li class="milestone">
                    <app-milestone-row
                      [milestone]="row.milestone"
                      [game]="gameId()"
                      [location]="row.revisit"
                      [revisit]="!!row.revisit"
                      [done]="row.done"
                      [compact]="true"
                    />
                  </li>
                } @else {
                  @let location = row.location;
                  <li>
                    <a
                      class="card"
                      [class.open]="location.id === activeLocationId()"
                      [attr.aria-current]="location.id === activeLocationId() ? 'page' : null"
                      [routerLink]="['/', game(), 'guide', location.id]"
                    >
                      <span class="card-head">
                        <mat-icon class="kind" aria-hidden="true">{{ location.icon }}</mat-icon>
                        <span class="name">{{ location.name }}</span>
                        <span class="count" [class.done]="location.complete">
                          {{ location.caught }}/{{ location.total }}
                        </span>
                        @if (location.items.total) {
                          <span
                            class="count items"
                            [class.done]="location.items.taken === location.items.total"
                            title="Items picked up"
                          >
                            <mat-icon aria-hidden="true">inventory_2</mat-icon>
                            <span class="sr-only">Items</span>
                            {{ location.items.taken }}/{{ location.items.total }}
                          </span>
                        }
                      </span>

                      @if (location.requirements.length) {
                        <span class="reqs">
                          @for (requirement of location.requirements; track requirement.id) {
                            <span class="req" [class.locked]="requirement.locked">
                              <mat-icon aria-hidden="true">lock</mat-icon>
                              {{ requirement.label }}
                            </span>
                          }
                        </span>
                      }

                      <span class="strip">
                        @for (species of location.species; track species.dex) {
                          <app-sprite
                            [dex]="species.dex"
                            [game]="gameId()"
                            [name]="species.name"
                            [dimmed]="!species.caught"
                            [size]="spriteSize()"
                          />
                        } @empty {
                          <span class="none">No wild Pokémon here</span>
                        }
                      </span>
                    </a>
                  </li>
                }
              }
            </ul>
          }
        </section>
      }

      @if (progressPart(); as part) {
        <button type="button" class="fab" (click)="jumpToProgress(part)">
          <mat-icon aria-hidden="true">my_location</mat-icon>
          You are here
        </button>
      }
    </div>

    <div class="detail-pane">
      <router-outlet />
    </div>

    <ng-template #partToggle let-part>
      <button
        type="button"
        [attr.aria-expanded]="!collapsed().has(part.part)"
        [attr.aria-controls]="'part-body-' + part.part"
        (click)="togglePart(part.part)"
      >
        <mat-icon aria-hidden="true">
          {{ collapsed().has(part.part) ? 'expand_more' : 'expand_less' }}
        </mat-icon>
        <span class="part-title">Part {{ part.part }} · {{ part.title }}</span>
        <span class="count">{{ part.caught }}/{{ part.total }}</span>
      </button>
      @if (part.story.total) {
        <a
          class="story-link"
          [routerLink]="['/', game(), 'story']"
          [fragment]="'part-' + part.part"
          [attr.aria-label]="
            'Part ' +
            part.part +
            ' in the story: ' +
            part.story.done +
            ' of ' +
            part.story.total +
            ' done'
          "
          title="This part in the story"
        >
          <mat-icon aria-hidden="true">flag</mat-icon>
          {{ part.story.done }}/{{ part.story.total }}
        </a>
      }
    </ng-template>
  `,
  styles: `
    /* The two-pane layout, part headers and the FAB are in shared/list-detail.scss (plan §13.2). */
    @media (min-width: 1200px) {
      .cards {
        grid-template-columns: minmax(0, 1fr);
      }
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
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 16px 0;
    }
    .toggles {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .status {
      color: var(--mat-sys-on-surface-variant);
    }
    .status.error {
      color: var(--mat-sys-error);
    }
    .region {
      margin: 24px 0 8px;
      font: var(--mat-sys-title-large);
    }
    .part {
      margin-top: 16px;
    }
    .count {
      font: var(--mat-sys-label-large);
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface-variant);
    }
    .count.done {
      color: var(--mat-sys-primary);
    }
    .count.items {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .count.items mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    /* Story milestones take a whole row of the card grid (plan §13.13). */
    .cards > .milestone {
      grid-column: 1 / -1;
    }
    .story-link {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      min-height: 48px;
      padding: 0 4px;
      font: var(--mat-sys-label-large);
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-primary);
      text-decoration: none;
    }
    .story-link mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .cards {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
      color: inherit;
      text-decoration: none;
    }
    .card.open {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-surface-container);
    }
    .card:hover {
      background: var(--mat-sys-surface-container);
    }
    .card-head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .name {
      flex: 1;
      min-width: 0;
      font: var(--mat-sys-title-small);
    }
    .kind {
      color: var(--mat-sys-primary);
    }
    .reqs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .req {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    .req.locked {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .req mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .strip {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    .none {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class GuidePage {
  private readonly document = inject(DOCUMENT);
  private readonly currentGame = inject(CurrentGameService);
  private readonly gameData = inject(GameDataService);
  private readonly profiles = inject(ProfileStore);
  protected readonly settings = inject(SettingsStore);

  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();

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

  /** The location open in the detail pane, from the child route (`/:game/guide/:locationId`). */
  protected readonly activeLocationId = computed(() => this.currentGame.path().split('/')[3] ?? '');
  protected readonly hasDetail = computed(() => this.activeLocationId() !== '');

  protected readonly search = signal('');
  protected readonly hideCompleted = signal(false);
  protected readonly collapsed = signal<ReadonlySet<number>>(new Set());
  protected readonly selectedCategories = signal<ReadonlySet<EncounterMethodCategory>>(new Set());

  protected readonly onlyAvailable = this.settings.select('hideUnavailable');
  protected readonly showStory = this.settings.select('guideShowStory');
  /** Only games with a story checklist get story rows and the chip. */
  protected readonly hasStory = computed(() => (this.data().view()?.milestones.length ?? 0) > 0);
  protected readonly spriteSize = computed(() =>
    this.settings.settings().spriteScale === 3 ? 42 : 32,
  );

  /** Only the active profile's progress counts, and only when it is for this game (plan §11.4). */
  protected readonly progressPart = computed(() => {
    const profile = this.profiles.activeProfile();
    return profile?.game === this.gameId() ? profile.progressPart : undefined;
  });

  protected readonly showRegion = computed(() => (this.definition()?.regions.length ?? 0) > 1);

  protected readonly categories = computed(() => {
    const view = this.data().view();
    return view ? categoriesIn(view, this.gameId()) : [];
  });

  protected readonly parts = computed<GuidePart[]>(() => {
    const view = this.data().view();
    if (!view) return [];
    return buildGuide({
      view,
      journey: this.data().journey(),
      game: this.gameId(),
      caught: this.profiles.caughtSet(),
      itemsTaken: this.profiles.itemsTakenIn(this.gameId()),
      milestonesDone: this.profiles.milestonesDoneIn(this.gameId()),
      progressPart: this.progressPart(),
      filters: {
        search: this.search(),
        hideCompleted: this.hideCompleted(),
        onlyAvailable: this.onlyAvailable(),
        categories: this.selectedCategories(),
        showEmpty: this.settings.settings().showEmptyLocations,
        showStory: this.showStory(),
      },
    });
  });

  protected readonly obtainableTotal = computed(
    () =>
      this.data()
        .checklist()
        .filter((e) => e.obtainable).length,
  );

  protected readonly caughtObtainable = computed(() => {
    const caught =
      this.profiles.activeProfile()?.game === this.gameId()
        ? this.profiles.caughtSet()
        : new Set<number>();
    return this.data()
      .checklist()
      .filter((e) => e.obtainable && caught.has(e.dex)).length;
  });

  protected label(category: EncounterMethodCategory): string {
    return categoryLabel(category);
  }

  protected region(part: GuidePart): string {
    return part.region ? regionName(part.region) : '';
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected toggleCategory(category: EncounterMethodCategory): void {
    const next = new Set(this.selectedCategories());
    if (!next.delete(category)) next.add(category);
    this.selectedCategories.set(next);
  }

  protected togglePart(part: number): void {
    const next = new Set(this.collapsed());
    if (!next.delete(part)) next.add(part);
    this.collapsed.set(next);
  }

  protected jumpToProgress(part: number): void {
    const parts = this.parts();
    const target = parts.find((p) => p.part >= part) ?? parts.at(-1);
    if (!target) return;
    const section = this.document.getElementById(`part-${target.part}`);
    section?.scrollIntoView({ block: 'start', behavior: scrollBehavior(this.document) });
    // Keyboard and screen-reader users land where the page scrolled to, on the part's toggle.
    section?.querySelector<HTMLElement>('.part-head button')?.focus({ preventScroll: true });
  }
}
