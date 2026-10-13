import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { milestoneKindLabel } from '../../core/domain/milestone-progress';
import type { GameId, Milestone } from '../../core/domain/models';
import { MilestoneToggle } from './milestone-toggle';

/**
 * One story milestone (plan §13.12): its toggle, label, kind and detail, and links to where it happens and to
 * the Pokémon it involves. Used by the Story page and the location page's Story section.
 */
@Component({
  selector: 'app-milestone-row',
  imports: [MatIconModule, RouterLink, MilestoneToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.done]': 'done()' },
  template: `
    <app-milestone-toggle [milestone]="milestone()" [game]="game()" />
    <span class="label">{{ milestone().label }}</span>
    <span class="tags">
      <span class="badge">{{ kindLabel() }}</span>
      @if (milestone().optional) {
        <span class="badge">Optional</span>
      }
    </span>
    @if (milestone().detail || location() || species()) {
      <p class="more">
        @if (milestone().detail; as detail) {
          <span>{{ detail }}</span>
        }
        @if (location(); as where) {
          <a [routerLink]="['/', game(), 'guide', where.id]">{{ where.name }}</a>
        }
        @if (species(); as pokemon) {
          <a [routerLink]="['/', game(), 'pokemon', pokemon.slug]">{{ pokemon.name }}</a>
        }
      </p>
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
  `,
})
export class MilestoneRow {
  readonly milestone = input.required<Milestone>();
  /** The game shown by the route. */
  readonly game = input.required<GameId>();
  /** Where it happens, linked; left out on that location's own page. */
  readonly location = input<{ id: string; name: string }>();
  readonly species = input<{ name: string; slug: string }>();
  readonly done = input(false);

  protected readonly kindLabel = computed(() => milestoneKindLabel(this.milestone().kind));
}
