import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameDataService } from '../../core/data/game-data.service';
import type { Milestone, Species, TrainerTeam } from '../../core/domain/models';
import { testSpecies } from '../../core/domain/testing/test-data';
import { ProfileStore } from '../../core/profiles/profile.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { MilestoneRow } from './milestone-row';
import { MilestoneTeam } from './milestone-team';

const species: Species[] = [
  testSpecies(1, { name: 'Bulbasaur', slug: 'bulbasaur', types: ['grass', 'poison'] }),
  testSpecies(4, { name: 'Charmander', slug: 'charmander', types: ['fire'] }),
  testSpecies(7, { name: 'Squirtle', slug: 'squirtle', types: ['water'] }),
  testSpecies(74, { name: 'Geodude', slug: 'geodude', types: ['rock', 'ground'] }),
  testSpecies(95, { name: 'Onix', slug: 'onix', types: ['rock', 'ground'] }),
];

const brock: TrainerTeam = {
  trainer: 'Brock',
  trainerClass: 'Leader',
  prize: 1386,
  pokemon: [
    {
      dex: 74,
      level: 12,
      gender: 'male',
      moves: [
        { name: 'Tackle', type: 'normal' },
        { name: 'Defense Curl', type: 'normal' },
      ],
    },
    { dex: 95, level: 14, moves: [{ name: 'Bide', type: 'normal' }] },
  ],
};

/** The rival's first team: he picks the starter strong against yours. */
const rival: TrainerTeam[] = [
  [1, 4],
  [4, 7],
  [7, 1],
].map(([chosen, his]) => ({
  trainer: 'Blue',
  prize: 175,
  variant: { kind: 'starter', dex: chosen! },
  pokemon: [{ dex: his!, level: 5, moves: [{ name: 'Tackle', type: 'normal' }] }],
}));

const gym: Milestone = {
  no: 6,
  id: 'gym-brock',
  label: 'Defeat Brock',
  kind: 'gym',
  part: { red: 3 },
  locationId: 'pewter-city',
  badge: 'Boulder',
  teams: { red: [brock] },
};

describe('MilestoneTeam and the MilestoneRow team panel (plan §13.12, Phase 19)', () => {
  let profiles: ProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        provideRouter([]),
        {
          provide: GameDataService,
          useValue: {
            forGame: () => ({
              view: signal({ speciesByDex: new Map(species.map((s) => [s.dex, s])) }),
            }),
          },
        },
      ],
    });
    profiles = TestBed.inject(ProfileStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render<T>(component: Type<T>, inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(component);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();

  describe('MilestoneTeam', () => {
    it('shows the trainer, and each Pokémon with its link, types, level, gender and moves', () => {
      const { el } = render(MilestoneTeam, { teams: [brock], game: 'red' });
      expect(el.querySelector('[role="tablist"]')).toBeNull();
      expect(text(el.querySelector('.trainer'))).toBe('Leader Brock · ₽1,386');
      const members = el.querySelectorAll('.members > li');
      expect(members).toHaveLength(2);
      expect(members[0]!.querySelector('a')?.getAttribute('href')).toBe('/red/pokemon/geodude');
      const who = (member: Element) =>
        [...member.querySelectorAll('.who > *')].map((part) => text(part));
      expect(who(members[0]!)).toEqual(['Geodude', '♂', 'male', 'Lv 12']);
      expect([...members[0]!.querySelectorAll('app-type-badge')].map(text)).toEqual([
        'Rock',
        'Ground',
      ]);
      expect([...members[0]!.querySelectorAll('.moves li')].map(text)).toEqual([
        'Tackle',
        'Defense Curl',
      ]);
      expect(members[0]!.querySelector('.moves li')?.getAttribute('title')).toBe('Normal move');
      expect(who(members[1]!)).toEqual(['Onix', 'Lv 14']);
    });

    it('has a tab per variant, and switches with a click or the arrow keys', () => {
      const { fixture, el } = render(MilestoneTeam, { teams: rival, game: 'red' });
      const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      expect(text(el.querySelector('.prompt'))).toBe('You chose');
      expect(tabs().map(text)).toEqual(['Bulbasaur', 'Charmander', 'Squirtle']);
      expect(tabs().map((t) => t.getAttribute('aria-label'))).toEqual([
        'If you chose Bulbasaur',
        'If you chose Charmander',
        'If you chose Squirtle',
      ]);
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(text(el.querySelector('.who a'))).toBe('Charmander');

      tabs()[2]!.click();
      fixture.detectChanges();
      expect(text(el.querySelector('.who a'))).toBe('Bulbasaur');
      expect(el.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(
        tabs()[2]!.id,
      );

      tabs()[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      fixture.detectChanges();
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    });

    it('opens on the starter you have caught, only with a profile for this game', () => {
      profiles.createProfile('Red run', 'red');
      profiles.setCaught('red', 4, true);
      const { el } = render(MilestoneTeam, { teams: rival, game: 'red' });
      expect(el.querySelector('[aria-selected="true"]')?.getAttribute('aria-label')).toBe(
        'If you chose Charmander',
      );

      const other = render(MilestoneTeam, { teams: rival, game: 'blue' });
      expect(other.el.querySelector('[aria-selected="true"]')?.getAttribute('aria-label')).toBe(
        'If you chose Bulbasaur',
      );
    });
  });

  describe('MilestoneRow', () => {
    it('has a collapsed Team button with the level range that opens the panel', () => {
      const { fixture, el } = render(MilestoneRow, { milestone: gym, game: 'red' });
      const button = el.querySelector<HTMLButtonElement>('.team-toggle')!;
      expect(text(button)).toBe('expand_more Team · Lv 12–14');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(el.querySelector('app-milestone-team')).toBeNull();
      expect(text(el.querySelector('.tags'))).toBe('Gym');

      button.click();
      fixture.detectChanges();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      const panel = el.querySelector('app-milestone-team')!;
      expect(panel.id).toBe(button.getAttribute('aria-controls'));
      expect(text(panel.querySelector('.trainer'))).toBe('Leader Brock · ₽1,386');
    });

    it('has no Team button in a game without the team', () => {
      const { el } = render(MilestoneRow, {
        milestone: { ...gym, part: { blue: 3 } },
        game: 'blue',
      });
      expect(el.querySelector('.team-toggle')).toBeNull();
    });

    it('shows only the level tag on compact rows, and on statics and gifts', () => {
      const compact = render(MilestoneRow, { milestone: gym, game: 'red', compact: true });
      expect(compact.el.querySelector('.team-toggle')).toBeNull();
      expect(text(compact.el.querySelector('.badge.level'))).toBe('Lv 12–14');

      const snorlax: Milestone = {
        no: 40,
        id: 'snorlax',
        label: 'Wake the Snorlax',
        kind: 'encounter',
        part: { red: 11 },
        locationId: 'route-16',
        dex: 143,
      };
      const row = render(MilestoneRow, {
        milestone: snorlax,
        game: 'red',
        levels: { min: 30, max: 30 },
      });
      expect([...row.el.querySelectorAll('.badge')].map(text)).toEqual(['Lv 30', 'Encounter']);
      expect(row.el.querySelector('.team-toggle')).toBeNull();
    });
  });
});
