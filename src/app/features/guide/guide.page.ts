import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { findGame } from '../../core/games/registry';

@Component({
  selector: 'app-guide-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ gameName() }} guide</h1>
    <p>Locations in walkthrough order will appear here (Phase 3).</p>
  `,
})
export class GuidePage {
  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();
  protected readonly gameName = computed(() => findGame(this.game())?.name ?? '');
}
