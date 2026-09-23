import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { GameDataService } from '../../core/data/game-data.service';
import { buildGameView } from '../../core/domain/game-view';
import { buildChecklist } from '../../core/domain/obtainability';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import { ProfileStore } from '../../core/profiles/profile.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { ChecklistPage } from './checklist.page';

const data = testData({
  games: ['red', 'blue'],
  types: ['normal', 'water'],
  species: [
    testSpecies(16, { name: 'Pidgey', slug: 'pidgey', types: ['normal', 'flying'] }),
    testSpecies(17, { name: 'Pidgeotto', slug: 'pidgeotto', types: ['normal', 'flying'] }),
    testSpecies(72, { name: 'Tentacool', slug: 'tentacool', types: ['water', 'poison'] }),
  ],
  evolutions: [{ from: 16, to: 17, trigger: 'level', level: 18, requiresTrade: false }],
  walkthroughs: { red: [{ part: 1, title: 'Pallet Town', region: 'kanto' }] },
  locations: [
    testLocation('route-1', 1, [testEncounter(16, ['red'])], ['red'], { name: 'Route 1' }),
    testLocation('route-2', 2, [testEncounter(72, ['blue'])], ['red', 'blue'], { name: 'Route 2' }),
  ],
});

const view = buildGameView(data, 'red');
const entries = buildChecklist(data, { id: 'red', nationalDexMax: 72 }, {
  breeding: false,
} as never);

const stub = {
  isLoading: signal(false),
  error: signal(undefined),
  data: signal(data),
  view: signal(view),
  species: signal(data.species),
  checklist: signal(entries),
  maxInOneSave: signal(2),
};

describe('ChecklistPage (plan §13.6)', () => {
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
    const fixture = TestBed.createComponent(ChecklistPage);
    fixture.componentRef.setInput('game', 'red');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const chip = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) =>
      b.textContent?.includes(text),
    )!;

  it('summarises progress and the max in one save', () => {
    const { el } = render();
    expect(el.querySelector('.headline')?.textContent).toContain('0');
    expect(el.querySelector('.headline')?.textContent).toContain('2 obtainable');
    expect(el.querySelector('.summary')?.textContent).toContain('Max in one save: 2');
  });

  it('shows obtainable species as tiles and the rest in the unobtainable section', () => {
    const { el } = render();
    expect([...el.querySelectorAll('.tile .name')].map((n) => n.textContent)).toEqual([
      'Pidgey',
      'Pidgeotto',
    ]);
    const unobtainable = el.querySelector('.unobtainable')!;
    expect(unobtainable.textContent).toContain('Tentacool');
    expect(unobtainable.textContent).toContain('Version exclusive');
  });

  it('toggles a catch from a grid tile once a profile for this game exists', () => {
    const { fixture, el } = render();
    const tile = el.querySelector<HTMLButtonElement>('.tile button')!;
    // Still focusable, but a click does nothing until a Red profile exists.
    expect(tile.getAttribute('aria-disabled')).toBe('true');
    tile.click();
    expect(profiles.isCaught(16)).toBe(false);

    profiles.createProfile('Red run', 'red');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.tile button')!.click();
    fixture.detectChanges();

    expect(profiles.isCaught(16)).toBe(true);
    expect(el.querySelector('.headline')?.textContent).toContain('1');
  });

  it('is one tab stop: arrow keys move between tiles and Enter opens the details', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, el } = render();
    const tiles = () => [...el.querySelectorAll<HTMLButtonElement>('.tile > button')];
    expect(tiles().map((t) => t.tabIndex)).toEqual([0, -1]);
    expect(el.querySelector<HTMLAnchorElement>('.tile .info')!.tabIndex).toBe(-1);

    tiles()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(tiles()[1]);
    expect(tiles().map((t) => t.tabIndex)).toEqual([-1, 0]);

    tiles()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navigate).toHaveBeenCalledWith(['/', 'red', 'pokemon', 'pidgeotto']);
  });

  it('filters by status and searches by number', () => {
    profiles.createProfile('Red run', 'red');
    profiles.setCaught('red', 16, true);
    const { fixture, el } = render();

    chip(el, 'Missing').click();
    fixture.detectChanges();
    expect([...el.querySelectorAll('.tile .name')].map((n) => n.textContent)).toEqual([
      'Pidgeotto',
    ]);

    chip(el, 'All').click();
    const search = el.querySelector<HTMLInputElement>('.search input')!;
    search.value = '#016';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect([...el.querySelectorAll('.tile .name')].map((n) => n.textContent)).toEqual(['Pidgey']);
  });

  it('lists every source of a species in the list view', () => {
    const { fixture, el } = render();
    chip(el, 'List').click();
    fixture.detectChanges();

    const rows = [...el.querySelectorAll('.row')];
    expect(rows[1]!.querySelector('.where')?.textContent).toContain('Evolves from Pidgey');

    rows[1]!.querySelector<HTMLButtonElement>('.expand')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.sources')?.textContent).toContain('Lv 18');
  });

  it('records which walkthrough part the player is on', () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el } = render();
    const select = el.querySelector<HTMLSelectElement>('.progress-part select')!;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(profiles.activeProfile()?.progressPart).toBe(1);
  });
});
