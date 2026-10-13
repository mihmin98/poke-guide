import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { GameId, Milestone } from '../../core/domain/models';
import { ProfileStore } from '../../core/profiles/profile.store';
import { ProgressOfferService } from '../../core/profiles/progress-offer.service';

/**
 * The done / not done toggle for one story milestone (plan §13.12, Phase 11). The item toggle's rules: it
 * writes only to the active profile, and only when that profile is for the URL's game. Ticking a milestone
 * from a later part than the profile's progress offers to move the progress there.
 */
@Component({
  selector: 'app-milestone-toggle',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="checkbox"
      [attr.aria-checked]="done()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="!editable()"
      [title]="title()"
      (click)="toggle()"
    >
      <mat-icon aria-hidden="true">{{ done() ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
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
export class MilestoneToggle {
  private readonly profiles = inject(ProfileStore);
  private readonly progressOffer = inject(ProgressOfferService);

  readonly milestone = input.required<Milestone>();
  /** The game shown by the route, not the profile's game. */
  readonly game = input.required<GameId>();

  protected readonly done = computed(() =>
    this.profiles.milestonesDoneIn(this.game()).has(this.milestone().no),
  );
  protected readonly editable = computed(() => this.profiles.canEditCatches(this.game()));

  protected readonly ariaLabel = computed(
    () => `${this.milestone().label}, ${this.done() ? 'done' : 'not done'}`,
  );

  protected readonly title = computed(() => {
    if (!this.editable()) {
      return this.profiles.activeProfile()
        ? 'Your active profile is for another game'
        : 'Create a profile to track your progress';
    }
    return this.done() ? 'Mark as not done' : 'Mark as done';
  });

  protected toggle(): void {
    const done = !this.done();
    const { no, label, part } = this.milestone();
    const changed = this.profiles.setMilestoneDone(
      this.game(),
      no,
      done,
      `${done ? 'Done' : 'Not done'}: ${label}`,
    );
    const milestonePart = part[this.game()];
    if (changed && done && milestonePart !== undefined)
      void this.progressOffer.offer(this.game(), milestonePart);
  }
}
