import { DestroyRef, Injectable, Injector, inject } from '@angular/core';
import type {
  MatSnackBarConfig,
  MatSnackBarRef,
  TextOnlySnackBar,
} from '@angular/material/snack-bar';

/**
 * `MatSnackBar`, loaded the first time a message is shown. The shell announces things (undo, storage
 * recovery, app updates) but rarely does, so Material's snackbar and the button it renders stay out
 * of the initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class LazySnackBar {
  private readonly injector = inject(Injector);
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  /** `undefined` when the app was torn down while the snackbar code loaded (only happens in tests). */
  async open(
    message: string,
    action?: string,
    config?: MatSnackBarConfig,
  ): Promise<MatSnackBarRef<TextOnlySnackBar> | undefined> {
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    if (this.destroyed) return undefined;
    return this.injector.get(MatSnackBar).open(message, action, config);
  }
}
