import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { battleLevels, teamsIn } from '../../core/domain/milestone-levels';
import { milestoneKindLabel } from '../../core/domain/milestone-progress';
import type { GameId, LevelSpec, Milestone } from '../../core/domain/models';
import { formatLevels } from './level-range';
import { MilestoneTeam } from './milestone-team';
import { MilestoneToggle } from './milestone-toggle';

let nextId = 0;

/**
 * One story milestone (plan §13.12): its toggle, label, kind and detail, and links to where it happens and to
 * the Pokémon it involves. Used by the Story page, the location page's Story section and, compact, between the
 * guide's location cards. A battle with a team gets a collapsed "Team · Lv 12–14" panel (Phase 19); a static
 * encounter or gift, and every compact row, shows only the level.
 */
@Component({
  selector: 'app-milestone-row',
  imports: [MatIconModule, RouterLink, MilestoneTeam, MilestoneToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.done]': 'done()', '[class.compact]': 'compact()' },
  template: `
    <app-milestone-toggle [milestone]="milestone()" [game]="game()" />
    <span class="label">{{ milestone().label }}</span>
    <span class="tags">
      @if (levelTag(); as level) {
        <span class="badge level">{{ level }}</span>
      }
      <span class="badge">{{ kindLabel() }}</span>
      @if (milestone().optional) {
        <span class="badge">Optional</span>
      }
    </span>
    @if (compact()) {
      @if (revisit() && location(); as where) {
        <p class="more">
          <a [routerLink]="['/', game(), section(), where.id]">Back to {{ where.name }}</a>
        </p>
      }
    } @else if (milestone().detail || location() || species()) {
      <p class="more">
        @if (milestone().detail; as detail) {
          <span>{{ detail }}</span>
        }
        @if (location(); as where) {
          <a [routerLink]="['/', game(), section(), where.id]">
            {{ revisit() ? 'Back to ' + where.name : where.name }}
          </a>
        }
        @if (species(); as pokemon) {
          <a [routerLink]="['/', game(), 'pokemon', pokemon.slug]">{{ pokemon.name }}</a>
        }
      </p>
    }
    @if (!compact() && teams().length) {
      <button
        type="button"
        class="team-toggle"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="teamId"
        (click)="expanded.set(!expanded())"
      >
        <mat-icon aria-hidden="true">{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
        Team · {{ teamLevelText() }}
      </button>
      @if (expanded()) {
        <app-milestone-team [id]="teamId" [teams]="teams()" [game]="game()" />
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: auto 1fr auto;
      grid-template-areas:
        'toggle label tags'
        'toggle more more';
      align-items: center;
      column-gap: 8px;
      padding: 4px 12px 4px 4px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    app-milestone-toggle {
      grid-area: toggle;
      align-self: start;
    }
    .label {
      grid-area: label;
      font: var(--mat-sys-body-large);
    }
    :host(.compact) {
      padding-block: 0;
      background: var(--mat-sys-surface-container-lowest);
      border: 1px dashed var(--mat-sys-outline-variant);
    }
    :host(.compact) .label {
      font: var(--mat-sys-body-medium);
    }
    :host(.done) .label {
      color: var(--mat-sys-on-surface-variant);
    }
    .tags {
      grid-area: tags;
      display: flex;
      flex-wrap: wrap;
      justify-content: end;
      gap: 4px;
    }
    .badge {
      padding: 1px 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    .more {
      grid-area: more;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      margin: 0 0 8px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .more a {
      color: var(--mat-sys-primary);
    }
    .level {
      font-variant-numeric: tabular-nums;
    }
    .team-toggle {
      grid-column: 2 / -1;
      justify-self: start;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 40px;
      margin: -4px 0 4px -8px;
      padding: 0 12px 0 4px;
      border: none;
      border-radius: 20px;
      background: none;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    .team-toggle:hover {
      background: var(--mat-sys-surface-container-highest);
    }
    app-milestone-team {
      grid-column: 2 / -1;
      margin-bottom: 8px;
    }
  `,
})
export class MilestoneRow {
  readonly milestone = input.required<Milestone>();
  /** The game shown by the route. */
  readonly game = input.required<GameId>();
  /** Where it happens, linked; left out on that location's own page. */
  readonly location = input<{ id: string; name: string }>();
  /** The location is from an earlier part: the link reads "Back to …" (plan §13.13). */
  readonly revisit = input(false);
  /** Where the location link opens: the Guide's or the Story's detail pane. */
  readonly section = input<'guide' | 'story'>('guide');
  readonly species = input<{ name: string; slug: string }>();
  readonly done = input(false);
  /** The guide's one-line form (plan §13.13): no detail, Pokémon or location link except "Back to …". */
  readonly compact = input(false);

  /** A static encounter's or gift's levels, from its encounter at the location (`encounterLevels`). */
  readonly levels = input<LevelSpec | null>(null);

  protected readonly kindLabel = computed(() => milestoneKindLabel(this.milestone().kind));
  protected readonly teams = computed(() => teamsIn(this.milestone(), this.game()));
  protected readonly teamLevelText = computed(() =>
    formatLevels(battleLevels(this.milestone(), this.game())),
  );
  /** Full rows show a battle's levels on its Team button instead. */
  protected readonly levelTag = computed(() =>
    this.teams().length
      ? this.compact()
        ? this.teamLevelText()
        : ''
      : formatLevels(this.levels()),
  );
  protected readonly expanded = signal(false);
  protected readonly teamId = `milestone-row-team-${nextId++}`;
}
