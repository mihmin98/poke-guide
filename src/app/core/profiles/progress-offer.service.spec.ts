import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { LazySnackBar } from '../../shared/lazy-snack-bar';
import { STATE_STORAGE } from '../storage/storage.service';
import { ProfileStore } from './profile.store';
import { ProgressOfferService } from './progress-offer.service';
import { UndoSnackbarService } from './undo-snackbar.service';

describe('ProgressOfferService (plan §13.12)', () => {
  let profiles: ProfileStore;
  let service: ProgressOfferService;
  let opened: string[];
  let dismiss: Subject<{ dismissedByAction: boolean }>;
  let undos: number;

  beforeEach(() => {
    opened = [];
    undos = 0;
    dismiss = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        {
          provide: LazySnackBar,
          useValue: {
            open: (message: string) => {
              opened.push(message);
              return Promise.resolve({ afterDismissed: () => dismiss });
            },
          },
        },
        { provide: UndoSnackbarService, useValue: { show: () => (undos++, Promise.resolve()) } },
      ],
    });
    profiles = TestBed.inject(ProfileStore);
    service = TestBed.inject(ProgressOfferService);
    profiles.createProfile('Red run', 'red');
  });

  afterEach(() => TestBed.resetTestingModule());

  async function answer(offer: Promise<void>, accepted: boolean): Promise<void> {
    await Promise.resolve();
    dismiss.next({ dismissedByAction: accepted });
    dismiss.complete();
    await offer;
  }

  it('moves the progress forward when accepted, and offers Undo', async () => {
    await answer(service.offer('red', 5), true);
    expect(opened).toEqual(['Move your progress to Part 5?']);
    expect(profiles.activeProfile()?.progressPart).toBe(5);
    expect(undos).toBe(1);
  });

  it('changes nothing when the snackbar times out', async () => {
    await answer(service.offer('red', 5), false);
    expect(profiles.activeProfile()?.progressPart).toBeUndefined();
    expect(undos).toBe(0);
  });

  it('never offers to move backwards, to the same part, or for another game', async () => {
    profiles.setProgressPart(6);
    await service.offer('red', 6);
    await service.offer('red', 3);
    await service.offer('blue', 9);
    expect(opened).toEqual([]);
    expect(service.wouldOffer('red', 7)).toBe(true);
  });

  it('does nothing if the progress moved past the part while the snackbar was up', async () => {
    const offer = service.offer('red', 5);
    await Promise.resolve();
    profiles.setProgressPart(8);
    await answer(offer, true);
    expect(profiles.activeProfile()?.progressPart).toBe(8);
  });
});
