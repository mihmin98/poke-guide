import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CONDITION_KINDS,
  formatCondition,
  type EncounterCondition,
} from '../../core/games/conditions';

/**
 * Encounter conditions as chips (plan §13.5). Conditions whose kind is displayed as a column
 * (time of day) are left out unless `includeColumns` is set, so a table can render them itself.
 */
@Component({
  selector: 'app-condition-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (chip of chips(); track chip.key) {
      <span class="chip" [title]="chip.kindLabel">{{ chip.text }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .chip {
      padding: 2px 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      white-space: nowrap;
    }
  `,
})
export class ConditionChips {
  readonly conditions = input.required<readonly EncounterCondition[] | undefined>();
  /** Also chip conditions that are normally rendered as table columns. */
  readonly includeColumns = input(false);

  protected readonly chips = computed(() => {
    const all = this.includeColumns();
    return (this.conditions() ?? [])
      .filter((c) => all || CONDITION_KINDS[c.kind].display === 'chip')
      .map((c, index) => ({
        key: `${c.kind}:${index}`,
        kindLabel: CONDITION_KINDS[c.kind].label,
        text: formatCondition(c),
      }));
  });
}
