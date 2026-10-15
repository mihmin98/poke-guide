import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { GameId } from '../../core/domain/models';
import type { StoryAreaRow } from '../../features/story/story-model';
import { Sprite } from './sprite';

/**
 * An area between two story milestones (plan §13.13): what you can catch and pick up there by that point of the
 * walkthrough, and how much more opens up later. Links to the location page.
 */
@Component({
  selector: 'app-area-card',
  imports: [MatIconModule, RouterLink, Sprite],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="card"
      [class.open]="open()"
      [attr.aria-current]="open() ? 'page' : null"
      [routerLink]="link()"
    >
      <span class="head">
        <mat-icon class="kind" aria-hidden="true">{{ area().icon }}</mat-icon>
        <span class="name">{{ area().name }}</span>
        @if (area().species.length) {
          <span
            class="count"
            [class.done]="area().caught === area().species.length"
            title="Pokémon caught"
          >
            <span class="sr-only">Pokémon caught</span>
            {{ area().caught }}/{{ area().species.length }}
          </span>
        }
        @if (area().items.total) {
          <span
            class="count"
            [class.done]="area().items.taken === area().items.total"
            title="Items picked up"
          >
            <mat-icon aria-hidden="true">inventory_2</mat-icon>
            <span class="sr-only">Items</span>
            {{ area().items.taken }}/{{ area().items.total }}
          </span>
        }
      </span>

      @if (area().species.length) {
        <span class="strip">
          @for (species of area().species; track species.dex) {
            <app-sprite
              [dex]="species.dex"
              [game]="game()"
              [name]="species.name"
              [dimmed]="!species.caught"
              [size]="spriteSize()"
            />
          }
        </span>
      }

      @if (area().later) {
        <span class="later">
          <mat-icon aria-hidden="true">lock</mat-icon>
          {{ laterText() }}
        </span>
      }
    </a>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      color: inherit;
      text-decoration: none;
    }
    .card:hover,
    .card.open {
      background: var(--mat-sys-surface-container);
    }
    .card.open {
      border-color: var(--mat-sys-primary);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kind {
      color: var(--mat-sys-primary);
    }
    .name {
      flex: 1;
      min-width: 0;
      font: var(--mat-sys-title-small);
    }
    .count {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font: var(--mat-sys-label-large);
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface-variant);
    }
    .count.done {
      color: var(--mat-sys-primary);
    }
    .count mat-icon,
    .later mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .strip {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    .later {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AreaCard {
  readonly area = input.required<StoryAreaRow>();
  readonly game = input.required<GameId>();
  readonly link = input.required<readonly string[]>();
  /** The location is open in the detail pane. */
  readonly open = input(false);
  readonly spriteSize = input(32);

  protected readonly laterText = computed(() => {
    const { later, locks } = this.area();
    return `${later} more later${locks.length ? ` · ${locks.join(', ')}` : ''}`;
  });
}
