import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { GameId } from '../../core/domain/models';
import { ProfileStore } from '../../core/profiles/profile.store';

/**
 * The picked up / not picked up toggle for one location item (plan §13.5, Phase 9). The same rules as
 * the catch toggle: it writes only to the active profile, and only when that profile is for the URL's
 * game. A square box, so it doesn't read as a Pokémon catch.
 */
@Component({
  selector: 'app-item-toggle',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="checkbox"
      [attr.aria-checked]="taken()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="!editable() || !!chosenInstead()"
      [title]="title()"
      (click)="toggle()"
    >
      <mat-icon aria-hidden="true">{{
        taken() ? 'check_box' : 'check_box_outline_blank'
      }}</mat-icon>
    </button>
  `,
  styles: `
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 48px;
      min-height: 48px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: none;
      cursor: pointer;
      color: var(--mat-sys-on-surface-variant);
    }
    button[aria-checked='true'] {
      color: var(--mat-sys-primary);
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.38;
    }
    button:not(:disabled):hover {
      background: var(--mat-sys-surface-container-highest);
    }
  `,
})
export class ItemToggle {
  private readonly profiles = inject(ProfileStore);

  /** `LocationItem.no`. */
  readonly no = input.required<number>();
  /** The game shown by the route, not the profile's game. */
  readonly game = input.required<GameId>();
  readonly name = input.required<string>();
  /** The option taken instead, in a choice group; the toggle is off until that one is unticked. */
  readonly chosenInstead = input<string>();

  protected readonly taken = computed(() => this.profiles.itemsTakenIn(this.game()).has(this.no()));
  protected readonly editable = computed(() => this.profiles.canEditCatches(this.game()));

  protected readonly ariaLabel = computed(() =>
    this.taken() ? `${this.name()}, picked up` : `${this.name()}, not picked up`,
  );

  protected readonly title = computed(() => {
    if (!this.editable()) {
      return this.profiles.activeProfile()
        ? 'Your active profile is for another game'
        : 'Create a profile to track your progress';
    }
    const other = this.chosenInstead();
    if (other) return `You chose the ${other}`;
    return this.taken() ? 'Mark as not picked up' : 'Mark as picked up';
  });

  protected toggle(): void {
    const taken = !this.taken();
    this.profiles.setItemTaken(
      this.game(),
      this.no(),
      taken,
      `${taken ? 'Picked up' : 'Put back'} ${this.name()}`,
    );
  }
}
