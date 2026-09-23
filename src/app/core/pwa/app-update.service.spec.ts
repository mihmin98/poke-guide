import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { STATE_STORAGE, StorageService } from '../storage/storage.service';
import { AppUpdateService, RELOAD_PAGE } from './app-update.service';

describe('AppUpdateService (plan §13.10)', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  /** Resolves the open snackbar as if its action (`true`) or its dismissal (`false`) happened. */
  let closeSnackbar: (byAction: boolean) => void;
  let messages: string[];

  function setup(enabled = true) {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    checkForUpdate = vi.fn(() => Promise.resolve(false));
    reload = vi.fn();
    messages = [];
    const snackBar = {
      open: (message: string) => {
        messages.push(message);
        const dismissed = new Subject<{ dismissedByAction: boolean }>();
        closeSnackbar = (byAction) => dismissed.next({ dismissedByAction: byAction });
        return { afterDismissed: () => dismissed };
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        {
          provide: SwUpdate,
          useValue: { isEnabled: enabled, versionUpdates, unrecoverable, checkForUpdate },
        },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: RELOAD_PAGE, useValue: reload },
      ],
    });
    TestBed.inject(AppUpdateService).start();
  }

  afterEach(() => TestBed.resetTestingModule());

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('offers a reload once a new version is ready, and saves before reloading', async () => {
    setup();
    const flush = vi.spyOn(TestBed.inject(StorageService), 'flush');
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    await settle();
    expect(messages).toEqual([]);

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    await settle();
    expect(messages).toEqual(['A new version of Poké Guide is ready.']);

    closeSnackbar(true);
    await settle();
    expect(flush).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the prompt is dismissed', async () => {
    setup();
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    await settle();
    closeSnackbar(false);
    await settle();
    expect(reload).not.toHaveBeenCalled();
  });

  it('asks for a reload when the cached copy is broken', async () => {
    setup();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });
    await settle();
    expect(messages[0]).toContain('out of date');
    closeSnackbar(true);
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('checks for updates when the page becomes visible again', () => {
    setup();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way when the service worker is disabled', async () => {
    setup(false);
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(messages).toEqual([]);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });
});
