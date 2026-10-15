import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { GameId } from '../../core/domain/models';
import type { StoryOpensRow } from '../../features/story/story-model';
import { Sprite } from './sprite';

/**
 * "Surf · 3 earlier areas have something you still need" (plan §13.13): after a milestone that unlocks
 * something, the areas already passed whose newly reachable Pokémon or items aren't all caught or taken yet.
 * Collapsed by default, since a rod can open a dozen areas at once.
 */
@Component({
  selector: 'app-unlock-callout',
  imports: [MatIconModule, RouterLink, Sprite],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details>
      <summary>
        <mat-icon aria-hidden="true">lock_open</mat-icon>
        <span class="text">
          <strong>{{ opens().label }}</strong> · {{ summary() }}
        </span>
      </summary>
      <ul>
        @for (area of opens().areas; track area.id) {
          <li>
            <a [routerLink]="[...base(), area.id]">{{ area.name }}</a>
            @for (species of area.species; track species.dex) {
              <app-sprite
                [dex]="species.dex"
                [game]="game()"
                [name]="species.name"
                [dimmed]="true"
                [size]="spriteSize()"
              />
            }
            @if (area.items) {
              <span class="items">
                <mat-icon aria-hidden="true">inventory_2</mat-icon>
                {{ area.items }} {{ area.items === 1 ? 'item' : 'items' }}
              </span>
            }
          </li>
        }
      </ul>
    </details>
  `,
  styles: `
    :host {
      display: block;
    }
    details {
      border-radius: 12px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    summary {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 4px 12px;
      font: var(--mat-sys-body-medium);
      cursor: pointer;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0 12px 8px 44px;
      display: grid;
      gap: 4px;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 8px;
    }
    a {
      color: inherit;
      font: var(--mat-sys-label-large);
    }
    .items {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font: var(--mat-sys-body-small);
    }
    .items mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `,
})
export class UnlockCallout {
  readonly opens = input.required<StoryOpensRow>();
  readonly game = input.required<GameId>();
  /** The route the areas link under: `['/', game, 'story']`. */
  readonly base = input.required<readonly string[]>();
  readonly spriteSize = input(32);

  protected readonly summary = computed(() => {
    const count = this.opens().areas.length;
    return count === 1
      ? '1 earlier area has something you still need'
      : `${count} earlier areas have something you still need`;
  });
}
