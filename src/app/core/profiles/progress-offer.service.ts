import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { GameId } from '../domain/models';
import { LazySnackBar } from '../../shared/lazy-snack-bar';
import { ProfileStore } from './profile.store';
import { UndoSnackbarService } from './undo-snackbar.service';

/**
 * "Move your progress to Part N?" after a story milestone is ticked (plan §13.12, decided 2026-10-13). Only
 * ever moves the active profile's `progressPart` forward, and only when the user accepts; the change can be
 * undone like any other.
 */
@Injectable({ providedIn: 'root' })
export class ProgressOfferService {
  private readonly snackBar = inject(LazySnackBar);
  private readonly profiles = inject(ProfileStore);
  private readonly undoSnackbar = inject(UndoSnackbarService);

  /** Whether ticking a milestone in `part` of `game` would offer anything. */
  wouldOffer(game: GameId, part: number): boolean {
    const profile = this.profiles.activeProfile();
    return profile?.game === game && (profile.progressPart ?? 0) < part;
  }

  async offer(game: GameId, part: number): Promise<void> {
    if (!this.wouldOffer(game, part)) return;
    const profileId = this.profiles.activeProfileId();
    const ref = await this.snackBar.open(`Move your progress to Part ${part}?`, 'Set', {
      duration: 8000,
    });
    if (!ref) return;
    const { dismissedByAction } = await firstValueFrom(ref.afterDismissed());
    // The profile or its part may have changed while the snackbar was up (another tick, another tab).
    if (!dismissedByAction || this.profiles.activeProfileId() !== profileId) return;
    if (!this.wouldOffer(game, part)) return;
    this.profiles.setProgressPart(part);
    void this.undoSnackbar.show();
  }
}
