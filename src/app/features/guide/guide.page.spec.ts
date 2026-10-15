import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { GameDataService } from '../../core/data/game-data.service';
import { buildGameView } from '../../core/domain/game-view';
import { buildJourney } from '../../core/domain/journey';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import { ProfileStore } from '../../core/profiles/profile.store';
import { SettingsStore } from '../../core/settings/settings.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { GuidePage } from './guide.page';

const data = testData({
  games: ['red'],
  species: [testSpecies(16, { name: 'Pidgey' }), testSpecies(19, { name: 'Rattata' })],
  walkthroughs: { red: [{ part: 1, title: 'Pallet Town', region: 'kanto' }] },
  locations: [
    testLocation('route-1', 1, [testEncounter(16, ['red']), testEncounter(19, ['red'])], ['red'], {
      name: 'Route 1',
    }),
  ],
  milestones: [
    {
      no: 3,
      id: 'rival-1',
      label: 'Rival battle 1',
      kind: 'battle',
      part: { red: 1 },
      locationId: 'route-1',
      detail: 'Not shown in the guide',
    },
  ],
});

const view = signal(buildGameView(data, 'red'));
const stub = {
  isLoading: signal(false),
  error: signal(undefined),
  view,
  journey: computed(() => buildJourney(view(), 'red')),
  checklist: signal([
    { dex: 16, obtainable: true, sources: [], exclusiveGroupIds: [] },
    { dex: 19, obtainable: true, sources: [], exclusiveGroupIds: [] },
  ]),
};

describe('GuidePage (plan §13.4)', () => {
  let profiles: ProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: GameDataService, useValue: { forGame: () => stub } },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(GuidePage);
    fixture.componentRef.setInput('game', 'red');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('lists the locations of each walkthrough part with a sprite strip', () => {
    const { el } = render();
    expect(el.querySelector('.part-title')?.textContent).toContain('Part 1 · Pallet Town');
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Route 1');
    expect(el.querySelectorAll('app-sprite').length).toBe(2);
    expect(el.querySelector('.card')?.getAttribute('href')).toBe('/red/guide/route-1');
    // One region, so no region headings: parts follow the <h1> directly as <h2>s.
    expect(el.querySelector('h2.part-head')).not.toBeNull();
    expect(el.querySelector('h3.part-head')).toBeNull();
  });

  it('counts caught species and updates as soon as a catch is toggled', () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el } = render();
    expect(el.querySelector('.card .count')?.textContent?.trim()).toBe('0/2');

    profiles.setCaught('red', 16, true);
    fixture.detectChanges();
    expect(el.querySelector('.card .count')?.textContent?.trim()).toBe('1/2');
    expect(el.querySelector('app-progress-ring svg')?.getAttribute('aria-label')).toBe(
      '1 of 2 obtainable without trading',
    );
  });

  it('searches locations and Pokémon', () => {
    const { fixture, el } = render();
    const input = el.querySelector('input')!;
    input.value = 'rattata';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.card').length).toBe(1);

    input.value = 'nothing';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.card').length).toBe(0);
    expect(el.querySelector('.status')?.textContent).toContain('No location matches');
  });

  it('shows the location detail beside the list and marks the open card', async () => {
    const harness = await RouterTestingHarness.create('/red/guide/route-1');
    const el = harness.routeNativeElement as HTMLElement;
    // The detail is a child route, so the guide page (the list pane) is still rendered.
    expect(el.querySelector('.list-pane')).not.toBeNull();
    expect(el.querySelector('app-location-page h1')?.textContent).toBe('Route 1');
    expect(el.getAttribute('data-detail')).toBe('true');
    expect(el.querySelector('.card.open')?.getAttribute('aria-current')).toBe('page');
  });

  it('collapses a part', () => {
    const { fixture, el } = render();
    const toggle = el.querySelector<HTMLButtonElement>('.part-head button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelectorAll('.card').length).toBe(0);
  });

  it('hides completed locations on request', () => {
    profiles.createProfile('Red run', 'red');
    profiles.bulkSetCaught('red', [16, 19], true);
    const { fixture, el } = render();
    const hide = [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) =>
      b.textContent?.includes('Hide completed'),
    )!;
    hide.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.card').length).toBe(0);
  });

  it('shows compact story rows between the cards, a chip to hide them and a link to the story part', () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el } = render();
    const items = [...el.querySelectorAll('.cards > li')];
    expect(items.map((li) => (li.classList.contains('milestone') ? 'milestone' : 'card'))).toEqual([
      'card',
      'milestone',
    ]);
    const row = el.querySelector('app-milestone-row')!;
    expect(row.querySelector('.label')?.textContent).toBe('Rival battle 1');
    expect(row.querySelector('.more')).toBeNull();
    const link = el.querySelector('.part-head .story-link')!;
    expect(link.getAttribute('href')).toBe('/red/story#part-1');
    expect(link.textContent).toContain('0/1');

    // Ticking it here ticks it on the profile, as on the Story page.
    row.querySelector<HTMLButtonElement>('app-milestone-toggle button')!.click();
    fixture.detectChanges();
    expect(profiles.activeProfile()?.milestonesDone).toEqual([3]);
    expect(link.textContent).toContain('1/1');

    const chip = [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) =>
      b.textContent?.includes('Show story'),
    )!;
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    chip.click();
    fixture.detectChanges();
    expect(el.querySelector('app-milestone-row')).toBeNull();
    expect(TestBed.inject(SettingsStore).settings().guideShowStory).toBe(false);
  });
});
