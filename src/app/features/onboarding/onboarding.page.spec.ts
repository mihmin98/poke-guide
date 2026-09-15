import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { ProfileStore } from '../../core/profiles/profile.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { OnboardingPage } from './onboarding.page';

describe('OnboardingPage (plan §11.3)', () => {
  let profiles: ProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render(game: string) {
    const fixture = TestBed.createComponent(OnboardingPage);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const submit = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  async function type(
    fixture: ReturnType<typeof render>['fixture'],
    el: HTMLElement,
    value: string,
  ) {
    const input = el.querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('names the game and refuses an empty name', () => {
    const { el } = render('yellow');
    expect(el.querySelector('h1')?.textContent).toContain('Yellow');
    expect(submit(el).disabled).toBe(true);
  });

  it('creates the profile for the URL game and opens its guide', async () => {
    const { fixture, el } = render('red');
    await type(fixture, el, '  My Red run  ');
    expect(submit(el).disabled).toBe(false);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(profiles.activeProfile()).toMatchObject({ name: 'My Red run', game: 'red', caught: [] });
    expect(TestBed.inject(Router).url).toBe('/red/guide');
  });

  it('lets you skip without creating anything', () => {
    const { el } = render('blue');
    const skip = [...el.querySelectorAll('a')].find((a) => a.textContent?.includes('Skip'));
    expect(skip?.getAttribute('href')).toBe('/blue/guide');
    expect(profiles.profiles()).toEqual([]);
  });
});
