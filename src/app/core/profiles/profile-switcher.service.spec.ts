import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { CurrentGameService } from '../routing/current-game.service';
import { STATE_STORAGE } from '../storage/storage.service';
import { ProfileSwitcherService } from './profile-switcher.service';
import { ProfileStore } from './profile.store';

describe('ProfileSwitcherService', () => {
  let router: Router;
  let profiles: ProfileStore;
  let switcher: ProfileSwitcherService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    router = TestBed.inject(Router);
    profiles = TestBed.inject(ProfileStore);
    switcher = TestBed.inject(ProfileSwitcherService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('follows the new profile to its game, keeping the section', async () => {
    const red = profiles.createProfile('Red run', 'red');
    const yellow = profiles.createProfile('Yellow run', 'yellow');

    await router.navigateByUrl('/red/checklist');
    await switcher.switchTo(yellow.id);
    expect(router.url).toBe('/yellow/checklist');

    await switcher.switchTo(red.id);
    expect(router.url).toBe('/red/checklist');
  });

  it('drops deeper segments that may not exist in the other game', async () => {
    profiles.createProfile('Red run', 'red');
    const yellow = profiles.createProfile('Yellow run', 'yellow');
    // A location deep link (Phase 3); the target may be absent or differently named in Yellow.
    await router.navigateByUrl('/red/guide/route-1');
    await switcher.switchTo(yellow.id);
    expect(router.url).toBe('/yellow/guide');
  });

  it('stays put on a page with no game in the URL, but repoints the shell', async () => {
    profiles.createProfile('Red run', 'red');
    const yellow = profiles.createProfile('Yellow run', 'yellow');
    await router.navigateByUrl('/profiles');

    await switcher.switchTo(yellow.id);
    expect(router.url).toBe('/profiles');
    // The nav and theme follow the active profile, so Guide now points at Yellow.
    expect(TestBed.inject(CurrentGameService).game()?.id).toBe('yellow');
  });

  it('does not navigate when the profile is already for the URL game', async () => {
    const red = profiles.createProfile('Red run', 'red');
    profiles.createProfile('Second Red run', 'red');
    await router.navigateByUrl('/red/guide');
    const navigate = vi.spyOn(router, 'navigate');
    await switcher.switchTo(red.id);
    expect(navigate).not.toHaveBeenCalled();
    expect(router.url).toBe('/red/guide');
  });
});
