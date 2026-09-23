import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { findMethod } from '../../core/games/methods';
import { icon } from '../icon';

/** The icon and label for an encounter method, from the method registry (plan §13.5). */
@Component({
  selector: 'app-method-icon',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-icon [attr.aria-hidden]="showLabel() ? 'true' : null" [attr.aria-label]="ariaLabel()">
      {{ icon() }}
    </mat-icon>
    @if (showLabel()) {
      <span class="label">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .label {
      font: var(--mat-sys-label-large);
    }
  `,
})
export class MethodIcon {
  readonly method = input.required<string>();
  readonly showLabel = input(false);

  private readonly definition = computed(() => findMethod(this.method()));
  protected readonly icon = computed(() => this.definition()?.icon ?? icon('help'));
  protected readonly label = computed(() => this.definition()?.label ?? this.method());
  protected readonly ariaLabel = computed(() => (this.showLabel() ? null : this.label()));
}
