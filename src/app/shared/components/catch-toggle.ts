import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { GameId } from '../../core/domain/models';
import { ProfileStore } from '../../core/profiles/profile.store';

/**
 * The caught / not caught toggle for one species (plan §13.5). Writes only to the active profile,
 * and only when that profile is for the URL's game (plan §11.4); otherwise it is disabled and the
 * page shows the mismatch banner.
 */
@Component({
  selector: 'app-catch-toggle',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="checkbox"
      [attr.aria-checked]="caught()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="!editable()"
      [title]="title()"
      (click)="toggle()"
    >
      <mat-icon aria-hidden="true">{{
        caught() ? 'check_circle' : 'radio_button_unchecked'
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
export class CatchToggle {
  private readonly profiles = inject(ProfileStore);

  readonly dex = input.required<number>();
  /** The game shown by the route, not the profile's game. */
  readonly game = input.required<GameId>();
  readonly name = input<string>('');

  protected readonly caught = computed(() => this.profiles.caughtSet().has(this.dex()));
  protected readonly editable = computed(() => this.profiles.canEditCatches(this.game()));

  protected readonly ariaLabel = computed(() => {
    const what = this.name() || `#${this.dex()}`;
    return this.caught() ? `${what}, caught` : `${what}, not caught`;
  });

  protected readonly title = computed(() => {
    if (this.editable()) return this.caught() ? 'Mark as not caught' : 'Mark as caught';
    return this.profiles.activeProfile()
      ? 'Your active profile is for another game'
      : 'Create a profile to track your progress';
  });

  protected toggle(): void {
    const what = this.name() || `#${this.dex()}`;
    const caught = !this.caught();
    this.profiles.setCaught(
      this.game(),
      this.dex(),
      caught,
      `${caught ? 'Caught' : 'Uncaught'} ${what}`,
    );
  }
}
