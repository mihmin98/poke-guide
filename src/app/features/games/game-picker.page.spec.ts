import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { ProfileStore } from '../../core/profiles/profile.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { GamePickerPage } from './game-picker.page';

describe('GamePickerPage (plan §13.3)', () => {
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

  function render() {
    const fixture = TestBed.createComponent(GamePickerPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const cardFor = (el: HTMLElement, game: string) =>
    el.querySelector<HTMLAnchorElement>(`.game-${game} .card`);

  it('offers to start a game that has no profile, linking to onboarding', () => {
    const card = cardFor(render(), 'red');
    expect(card?.querySelector('.action')?.textContent?.trim()).toBe('Start');
    expect(card?.getAttribute('href')).toBe('/red/welcome');
  });

  it('counts the profiles per game and links straight to the guide', () => {
    profiles.createProfile('Run one', 'red');
    profiles.createProfile('Run two', 'red');
    profiles.createProfile('Yellow run', 'yellow');
    const el = render();
    expect(cardFor(el, 'red')?.querySelector('.action')?.textContent?.trim()).toBe('2 profiles');
    expect(cardFor(el, 'red')?.getAttribute('href')).toBe('/red/guide');
    expect(cardFor(el, 'yellow')?.querySelector('.action')?.textContent?.trim()).toBe('1 profile');
    expect(cardFor(el, 'blue')?.querySelector('.action')?.textContent?.trim()).toBe('Start');
  });
});
