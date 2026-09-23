import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { LevelSpec } from '../../core/domain/models';

/** `Lv 5` · `Lv 2–5` (plan §13.5). */
export function formatLevels(levels: LevelSpec | null | undefined): string {
  if (!levels) return '';
  return levels.min === levels.max ? `Lv ${levels.min}` : `Lv ${levels.min}–${levels.max}`;
}

/** The exact levels when they are not one continuous range, e.g. `8, 10, 12`. */
export function formatLevelValues(levels: LevelSpec | null | undefined): string | null {
  return levels?.values?.length ? levels.values.join(', ') : null;
}

/**
 * An encounter's level range. A gapped range (`8, 10, 12`) keeps the compact text and lists the
 * exact levels in the tooltip and for screen readers.
 */
@Component({
  selector: 'app-level-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (text()) {
      <span [title]="values() ?? ''">{{ text() }}</span>
      @if (values(); as list) {
        <span class="sr-only">, levels {{ list }}</span>
      }
    } @else {
      <span aria-label="Level unknown">—</span>
    }
  `,
  styles: `
    :host {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class LevelRange {
  readonly levels = input.required<LevelSpec | null>();

  protected readonly text = computed(() => formatLevels(this.levels()));
  protected readonly values = computed(() => formatLevelValues(this.levels()));
}
