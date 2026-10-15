import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterOutlet, Scroll } from '@angular/router';
import { filter, map } from 'rxjs';
import { GameDataService } from '../../core/data/game-data.service';
import { milestoneProgress } from '../../core/domain/milestone-progress';
import type { GameId } from '../../core/domain/models';
import { findGame, regionName } from '../../core/games/registry';
import { ProfileStore } from '../../core/profiles/profile.store';
import { CurrentGameService } from '../../core/routing/current-game.service';
import { SettingsStore } from '../../core/settings/settings.store';
import { AreaCard } from '../../shared/components/area-card';
import { GameMismatchBanner } from '../../shared/components/game-mismatch-banner';
import { MilestoneRow } from '../../shared/components/milestone-row';
import { ProgressRing } from '../../shared/components/progress-ring';
import { UnlockCallout } from '../../shared/components/unlock-callout';
import { scrollBehavior } from '../../shared/motion';
import { buildStory, type StoryPart } from './story-model';

/**
 * `/:game/story` (plan §13.12, §13.13): gyms, major battles, story events, key items, story encounters and
 * gifts in walkthrough order, with the areas you pass between them and what later unlocks open up. Never counts
 * towards any Pokémon figure. A location opens beside the list from 1200 px (`/:game/story/:locationId`).
 * `#part-N` and `#m-<milestoneId>` scroll to a part or a milestone.
 */
@Component({
  selector: 'app-story-page',
  imports: [
    NgTemplateOutlet,
    MatIconModule,
    RouterOutlet,
    AreaCard,
    GameMismatchBanner,
    MilestoneRow,
    ProgressRing,
    UnlockCallout,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-detail]': 'hasDetail()' },
  styleUrl: '../../shared/list-detail.scss',
  template: `
    <div class="list-pane">
      <header class="head">
        <div>
          <h1>{{ gameName() }} story</h1>
          <p class="sub">The story in walkthrough order, with the areas you pass on the way.</p>
        </div>
        @if (progress().total) {
          <app-progress-ring
            [value]="progress().done"
            [total]="progress().total"
            label="story milestones done"
          />
        }
      </header>

      <app-game-mismatch-banner [game]="gameId()" />

      @if (progress().total) {
        <div class="controls">
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="hideDone()"
            (click)="hideDone.set(!hideDone())"
          >
            Hide done
          </button>
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="hideFinished()"
            title="Hide areas where everything you can reach is caught and picked up"
            (click)="hideFinished.set(!hideFinished())"
          >
            Hide finished areas
          </button>
        </div>
      }

      @if (data().isLoading()) {
        <p class="status">Loading {{ gameName() }} data…</p>
      } @else if (data().error()) {
        <p class="status error">
          The {{ gameName() }} data could not be loaded. Check your connection and reload.
        </p>
      } @else if (progress().total === 0) {
        <p class="status">There is no story checklist for {{ gameName() }} yet.</p>
      } @else if (hideDone() && progress().done === progress().total) {
        <p class="status">Every story milestone is done.</p>
      } @else if (parts().length === 0) {
        <p class="status">Nothing left to show with these filters.</p>
      }

      @if (progress().total) {
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
              <ol class="rows" [id]="'part-body-' + part.part">
                @for (row of part.rows; track row.key) {
                  @if (row.kind === 'milestone') {
                    <li class="milestone" [id]="'m-' + row.milestone.id">
                      <app-milestone-row
                        [milestone]="row.milestone"
                        [game]="gameId()"
                        [location]="row.location"
                        [revisit]="row.revisit"
                        section="story"
                        [species]="row.species"
                        [done]="row.done"
                      />
                    </li>
                  } @else if (row.kind === 'area') {
                    <li class="area">
                      <app-area-card
                        [area]="row"
                        [game]="gameId()"
                        [link]="['/', game(), 'story', row.id]"
                        [open]="row.id === activeLocationId()"
                        [spriteSize]="spriteSize()"
                      />
                    </li>
                  } @else {
                    <li class="opens">
                      <app-unlock-callout
                        [opens]="row"
                        [game]="gameId()"
                        [base]="['/', game(), 'story']"
                        [spriteSize]="spriteSize()"
                      />
                    </li>
                  }
                }
              </ol>
            }
          </section>
        }
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
        @if (part.progress.total) {
          <span class="count" [class.done]="part.progress.done === part.progress.total">
            {{ part.progress.done }}/{{ part.progress.total }}
          </span>
        }
      </button>
    </ng-template>
  `,
  styles: `
    /* The two-pane layout, part headers and the FAB are in shared/list-detail.scss (plan §13.2). */
    .list-pane {
      padding-bottom: 72px;
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
      gap: 8px;
      flex-wrap: wrap;
      margin: 16px 0;
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
      scroll-margin-top: var(--stick-top, var(--app-toolbar-height, 64px));
    }
    .count {
      font: var(--mat-sys-label-large);
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface-variant);
    }
    .count.done {
      color: var(--mat-sys-primary);
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    /* Clear the sticky toolbar and part header when a deep link scrolls a milestone into view. */
    .rows > li {
      scroll-margin-top: calc(var(--stick-top, var(--app-toolbar-height, 64px)) + 64px);
    }
    /* Areas are the road between milestones: indented, so the story steps stand out. */
    .area,
    .opens {
      margin-left: 16px;
    }
  `,
})
export class StoryPage {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly currentGame = inject(CurrentGameService);
  private readonly gameData = inject(GameDataService);
  private readonly profiles = inject(ProfileStore);
  private readonly settings = inject(SettingsStore);

  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();

  protected readonly gameId = computed(() => this.game() as GameId);
  private readonly definition = computed(() => findGame(this.game()));
  protected readonly gameName = computed(() => this.definition()?.name ?? '');
  /** `forGame` starts an effect, so it must not run inside a reactive context (NG0602). */
  protected readonly data = computed(() => {
    const id = this.gameId();
    return untracked(() => this.gameData.forGame(id));
  });

  /** The location open in the detail pane, from the child route (`/:game/story/:locationId`). */
  protected readonly activeLocationId = computed(() => this.currentGame.path().split('/')[3] ?? '');
  protected readonly hasDetail = computed(() => this.activeLocationId() !== '');

  protected readonly hideDone = signal(false);
  protected readonly hideFinished = signal(false);
  protected readonly collapsed = signal<ReadonlySet<number>>(new Set());

  protected readonly showRegion = computed(() => (this.definition()?.regions.length ?? 0) > 1);
  protected readonly spriteSize = computed(() =>
    this.settings.settings().spriteScale === 3 ? 42 : 32,
  );

  private readonly done = computed(() => this.profiles.milestonesDoneIn(this.gameId()));

  /** Only the active profile's progress counts, and only when it is for this game (plan §11.4). */
  protected readonly progressPart = computed(() => {
    const profile = this.profiles.activeProfile();
    return profile?.game === this.gameId() ? profile.progressPart : undefined;
  });

  protected readonly progress = computed(() =>
    milestoneProgress(this.data().view()?.milestones ?? [], this.done()),
  );

  /** Caught and taken only count for the active profile when it is for this game. */
  private readonly caught = computed(() =>
    this.profiles.activeProfile()?.game === this.gameId()
      ? this.profiles.caughtSet()
      : new Set<number>(),
  );

  protected readonly parts = computed<StoryPart[]>(() => {
    const view = this.data().view();
    if (!view) return [];
    return buildStory({
      view,
      journey: this.data().journey(),
      game: this.gameId(),
      done: this.done(),
      caught: this.caught(),
      itemsTaken: this.profiles.itemsTakenIn(this.gameId()),
      hideDone: this.hideDone(),
      hideFinished: this.hideFinished(),
    });
  });

  /**
   * The fragment of the latest navigation, once the router has done its own scrolling (to the top). A fresh
   * object per navigation, so following the same link twice scrolls again; `null` when the router restored a
   * position (back and forward) or there is no fragment.
   */
  private readonly anchor = toSignal(
    this.router.events.pipe(
      filter((e): e is Scroll => e instanceof Scroll),
      map((e) => (e.anchor && !e.position ? { id: e.anchor } : null)),
    ),
    { initialValue: null },
  );
  private handledAnchor: { id: string } | null = null;

  /** The part a `#part-N` or `#m-<milestoneId>` fragment points into, once the data is in. */
  private readonly anchorPart = computed(() => {
    const id = this.anchor()?.id;
    const view = this.data().view();
    if (!id || !view) return undefined;
    const part = /^part-(\d+)$/.exec(id);
    if (part) return Number(part[1]);
    const milestone = id.startsWith('m-')
      ? view.milestones.find((m) => m.id === id.slice(2))
      : undefined;
    return milestone?.part[this.gameId()];
  });

  constructor() {
    // A deep link into a collapsed part opens it first.
    effect(() => {
      const part = this.anchorPart();
      if (part !== undefined && untracked(this.collapsed).has(part)) {
        const next = new Set(untracked(this.collapsed));
        next.delete(part);
        this.collapsed.set(next);
      }
    });
    // Then, once the rows are on screen (the data may still be loading on a cold start), scroll there.
    afterRenderEffect(() => {
      const anchor = this.anchor();
      const part = this.anchorPart();
      if (!anchor || anchor === this.handledAnchor || part === undefined) return;
      if (this.collapsed().has(part)) return;
      const target =
        this.document.getElementById(anchor.id) ?? this.document.getElementById(`part-${part}`);
      if (!target) return;
      this.handledAnchor = anchor;
      this.scrollTo(target);
    });
  }

  protected region(part: StoryPart): string {
    return part.region ? regionName(part.region) : '';
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
    if (section) this.scrollTo(section);
  }

  /** Scrolls a part or a row into view and moves focus there, for keyboard and screen-reader users. */
  private scrollTo(target: HTMLElement): void {
    target.scrollIntoView?.({ block: 'start', behavior: scrollBehavior(this.document) });
    const focusable =
      target.tagName === 'SECTION'
        ? target.querySelector<HTMLElement>('.part-head button')
        : // A row's toggle is disabled without a profile for this game; its links still take focus.
          target.querySelector<HTMLElement>('button:not(:disabled), a[href]');
    focusable?.focus({ preventScroll: true });
  }
}
