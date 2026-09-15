import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ProfileSwitcherService } from './profile-switcher.service';
import { ProfileStore } from './profile.store';

/**
 * Shows "<change> · Undo" after a profile change (plan §12.1). The store decides whether the
 * change is still undoable, so a snackbar whose entry was invalidated (another tab edited the
 * profiles) simply does nothing.
 */
@Injectable({ providedIn: 'root' })
export class UndoSnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly profiles = inject(ProfileStore);
  private readonly switcher = inject(ProfileSwitcherService);

  /** Announces the store's most recent change, with an Undo action. */
  async show(): Promise<void> {
    const label = this.profiles.lastChange()?.label;
    if (!label) return;
    const ref = this.snackBar.open(label, 'Undo', { duration: 6000 });
    // `afterDismissed` also resolves when the snackbar simply times out, so check why it closed.
    const { dismissedByAction } = await firstValueFrom(ref.afterDismissed());
    if (!dismissedByAction) return;
    const undone = this.profiles.undo();
    // Undoing a switch restores the previous profile, so follow it back to its game.
    await this.switcher.followActiveProfile();
    this.snackBar.open(undone ? `Undid: ${undone.label}` : 'Nothing left to undo', undefined, {
      duration: 3000,
    });
  }
}
