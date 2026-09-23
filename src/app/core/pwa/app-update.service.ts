import { DOCUMENT, DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { SwUpdate, type VersionEvent, type VersionReadyEvent } from '@angular/service-worker';
import { filter, firstValueFrom } from 'rxjs';
import { LazySnackBar } from '../../shared/lazy-snack-bar';
import { StorageService } from '../storage/storage.service';

/** Reloads the page; a token so tests can observe it. */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => {
    const location = inject(DOCUMENT).location;
    return () => location.reload();
  },
});

const isReady = (event: VersionEvent): event is VersionReadyEvent => event.type === 'VERSION_READY';

/**
 * The service worker's update prompt (plan §13.10). The worker downloads a new version (app and data
 * files together, so they always match) in the background; this offers a reload once it is ready, and
 * forces one when the cached copy is broken. An installed app can stay open for days without a
 * navigation, so it also checks for updates whenever the page becomes visible again.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  /** Only provided in the browser build (`provideServiceWorker`), and disabled in dev mode. */
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(LazySnackBar);
  private readonly storage = inject(StorageService);
  private readonly reloadPage = inject(RELOAD_PAGE);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  start(): void {
    const updates = this.updates;
    if (!updates?.isEnabled) return;
    void this.promptWhenReady(updates);
    void this.recoverWhenBroken(updates);
    const onVisible = () => {
      if (this.document.visibilityState === 'visible') updates.checkForUpdate().catch(() => false);
    };
    this.document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() =>
      this.document.removeEventListener('visibilitychange', onVisible),
    );
  }

  private async promptWhenReady(updates: SwUpdate): Promise<void> {
    await firstValueFrom(updates.versionUpdates.pipe(filter(isReady)));
    await this.offerReload('A new version of Poké Guide is ready.');
  }

  private async recoverWhenBroken(updates: SwUpdate): Promise<void> {
    await firstValueFrom(updates.unrecoverable);
    await this.offerReload("Poké Guide's offline copy is out of date. Reload to fix it.");
  }

  private async offerReload(message: string): Promise<void> {
    const ref = await this.snackBar.open(message, 'Reload');
    if (!ref) return;
    const { dismissedByAction } = await firstValueFrom(ref.afterDismissed());
    if (!dismissedByAction) return;
    // Don't lose a catch toggled in the last moment before the debounced write.
    this.storage.flush();
    this.reloadPage();
  }
}
