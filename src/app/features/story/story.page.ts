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
import { MatIconModule } from '@angular/material/icon';
import { GameDataService } from '../../core/data/game-data.service';
import { milestoneProgress } from '../../core/domain/milestone-progress';
import type { GameId } from '../../core/domain/models';
import { findGame } from '../../core/games/registry';
import { ProfileStore } from '../../core/profiles/profile.store';
import { GameMismatchBanner } from '../../shared/components/game-mismatch-banner';
import { MilestoneRow } from '../../shared/components/milestone-row';
import { ProgressRing } from '../../shared/components/progress-ring';
import { scrollBehavior } from '../../shared/motion';
import { buildStory, type StoryPart } from './story-model';

/**
 * `/:game/story` (plan §13.12, Phase 11): gyms, major battles, story events, key items, story encounters and
 * gifts in walkthrough order. Never counts towards any Pokémon figure.
 */
@Component({
  selector: 'app-story-page',
  imports: [MatIconModule, GameMismatchBanner, MilestoneRow, ProgressRing],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <h1>{{ gameName() }} story</h1>
        <p class="sub">Gyms, battles, events and key items in walkthrough order.</p>
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
    } @else if (parts().length === 0) {
      <p class="status">Every story milestone is done.</p>
    }

    @for (part of parts(); track part.part) {
      <section class="part" [id]="'part-' + part.part">
        <h2 class="part-head">
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
            <span class="count" [class.done]="part.progress.done === part.progress.total">
              {{ part.progress.done }}/{{ part.progress.total }}
            </span>
          </button>
        </h2>

        @if (!collapsed().has(part.part)) {
          <ul class="rows" [id]="'part-body-' + part.part">
            @for (row of part.rows; track row.milestone.no) {
              <li>
                <app-milestone-row
                  [milestone]="row.milestone"
                  [game]="gameId()"
                  [location]="row.location"
                  [species]="row.species"
                  [done]="row.done"
                />
              </li>
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
  `,
  styles: `
    :host {
      display: block;
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
    .part {
      margin-top: 16px;
    }
    /* Spacing as padding, not margin: a stuck header's margin is transparent (see the guide page). */
    .part-head {
      position: sticky;
      top: var(--app-toolbar-height, 64px);
      z-index: 1;
      margin: 0 0 8px;
      padding: 4px 0;
      background: var(--mat-sys-surface);
    }
    .part-head button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 48px;
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: var(--mat-sys-title-medium);
      text-align: left;
      cursor: pointer;
    }
    .part-title {
      flex: 1;
      min-width: 0;
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
    .fab {
      position: fixed;
      right: 16px;
      bottom: calc(16px + env(safe-area-inset-bottom));
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
      padding: 0 16px;
      border: none;
      border-radius: 16px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      box-shadow: var(--mat-sys-level3);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
  `,
})
export class StoryPage {
  private readonly document = inject(DOCUMENT);
  private readonly gameData = inject(GameDataService);
  private readonly profiles = inject(ProfileStore);

  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();

  protected readonly gameId = computed(() => this.game() as GameId);
  protected readonly gameName = computed(() => findGame(this.game())?.name ?? '');
  /** `forGame` starts an effect, so it must not run inside a reactive context (NG0602). */
  protected readonly data = computed(() => {
    const id = this.gameId();
    return untracked(() => this.gameData.forGame(id));
  });

  protected readonly hideDone = signal(false);
  protected readonly collapsed = signal<ReadonlySet<number>>(new Set());

  private readonly done = computed(() => this.profiles.milestonesDoneIn(this.gameId()));

  /** Only the active profile's progress counts, and only when it is for this game (plan §11.4). */
  protected readonly progressPart = computed(() => {
    const profile = this.profiles.activeProfile();
    return profile?.game === this.gameId() ? profile.progressPart : undefined;
  });

  protected readonly progress = computed(() =>
    milestoneProgress(this.data().view()?.milestones ?? [], this.done()),
  );

  protected readonly parts = computed<StoryPart[]>(() => {
    const view = this.data().view();
    if (!view) return [];
    return buildStory({
      view,
      game: this.gameId(),
      done: this.done(),
      hideDone: this.hideDone(),
    });
  });

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
    section?.querySelector<HTMLElement>('.part-head button')?.focus({ preventScroll: true });
  }
}
