import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import type { GameId } from '../domain/models';
import { ProfileStore } from '../profiles/profile.store';
import { STATE_STORAGE, StorageService } from '../storage/storage.service';

describe('home redirect (plan §11.3)', () => {
  let router: Router;
  let profiles: ProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    router = TestBed.inject(Router);
    profiles = TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('sends a visitor with no profile to the game picker', async () => {
    await router.navigateByUrl('/');
    expect(router.url).toBe('/games');
  });

  it("sends a visitor to the active profile's guide", async () => {
    profiles.createProfile('My Yellow run', 'yellow');
    await router.navigateByUrl('/');
    expect(router.url).toBe('/yellow/guide');
  });

  it('falls back to the picker when the active profile is for an unsupported game', async () => {
    profiles.createProfile('Old save', 'red');
    // A profile saved by a newer app: its game is not in this build's registry.
    TestBed.inject(StorageService).update((s) => ({
      ...s,
      profiles: s.profiles.map((p) => ({ ...p, game: 'gold' as GameId })),
    }));
    await router.navigateByUrl('/');
    expect(router.url).toBe('/games');
  });
});
