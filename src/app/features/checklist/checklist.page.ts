import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { findGame } from '../../core/games/registry';

@Component({
  selector: 'app-checklist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ gameName() }} checklist</h1>
    <p>Every Pokémon obtainable without trading will be listed here (Phase 4).</p>
  `,
})
export class ChecklistPage {
  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();
  protected readonly gameName = computed(() => findGame(this.game())?.name ?? '');
}
