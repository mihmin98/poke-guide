import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { GameDataService } from '../../core/data/game-data.service';
import { buildGameView } from '../../core/domain/game-view';
import { testData, testSpecies } from '../../core/domain/testing/test-data';
import { GEN1_MECHANICS, gen1HpDv, gen1Stat } from '../../core/mechanics/gen1';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { CatchToolPage } from './catch.page';
import { IvToolPage } from './iv.page';

const PIKACHU_BASE = { hp: 35, atk: 55, def: 30, spc: 50, spe: 90 };

const data = testData({
  games: ['red', 'blue'],
  species: [
    testSpecies(25, {
      name: 'Pikachu',
      slug: 'pikachu',
      types: ['electric'],
      catchRate: 190,
      baseStats: PIKACHU_BASE,
    }),
    testSpecies(148, {
      name: 'Dragonair',
      slug: 'dragonair',
      catchRate: 45,
      catchRateByGame: { blue: 27 },
      baseStats: { hp: 61, atk: 84, def: 65, spc: 70, spe: 70 },
    }),
  ],
});

const stub = {
  isLoading: signal(false),
  error: signal(undefined),
  data: signal(data),
  view: signal(buildGameView(data, 'red')),
  species: signal(data.species),
  speciesByDex: signal(new Map(data.species.map((s) => [s.dex, s]))),
};

function setUp(): void {
  TestBed.configureTestingModule({
    providers: [
      { provide: STATE_STORAGE, useValue: null },
      { provide: GameDataService, useValue: { forGame: () => stub } },
      provideRouter(routes, ...routerFeatures),
    ],
  });
}

describe('CatchToolPage (plan §13.11)', () => {
  beforeEach(setUp);
  afterEach(() => TestBed.resetTestingModule());

  function render(inputs: { game?: string; dex?: string; level?: string } = {}) {
    const fixture = TestBed.createComponent(CatchToolPage);
    fixture.componentRef.setInput('game', inputs.game ?? 'red');
    if (inputs.dex !== undefined) fixture.componentRef.setInput('dex', inputs.dex);
    if (inputs.level !== undefined) fixture.componentRef.setInput('level', inputs.level);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const select = (el: HTMLElement, index: number) =>
    [...el.querySelectorAll('select')][index] as HTMLSelectElement;

  it('opens on the species named in the query parameter', () => {
    const { el } = render({ dex: '148' });
    expect(el.querySelector('.result h2')?.textContent).toBe('Dragonair');
    expect(el.querySelector('.result .sub')?.textContent).toContain('Catch rate 45');
  });

  it('uses the per-game catch rate', () => {
    const { el } = render({ game: 'blue', dex: '148' });
    expect(el.querySelector('.result .sub')?.textContent).toContain('Catch rate 27');
  });

  it('shows the chance per throw and how many balls are needed', () => {
    const { el } = render({ dex: '25' });
    const headline = el.querySelector('.headline')?.textContent?.trim() ?? '';
    expect(headline).toMatch(/^\d+(\.\d+)?%$/);
    expect(el.querySelector('.facts')?.textContent).toContain('Balls for a 50% chance');
    expect(el.textContent).toContain('Shakes when it breaks free');
  });

  it('recomputes when the ball changes', () => {
    const { fixture, el } = render({ dex: '25' });
    const before = el.querySelector('.headline')!.textContent;
    const ball = select(el, 1);
    ball.value = 'ultra';
    ball.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelector('.headline')!.textContent).not.toBe(before);
  });

  it('offers the Safari Game controls and the remaining-balls hint', () => {
    const { fixture, el } = render({ dex: '25' });
    expect(el.textContent).toContain('Safari Game');
    const ball = select(el, 1);
    ball.value = 'safari';
    ball.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelector('.safari')?.textContent).toContain('Safari Balls left');
  });

  it('estimates the max HP from the level and follows the slider', () => {
    const { fixture, el } = render({ dex: '25' });
    const expected = gen1Stat({ stat: 'hp', base: PIKACHU_BASE.hp, level: 20, iv: 7 });
    const maxHp = [...el.querySelectorAll('input[type="number"]')][1] as HTMLInputElement;
    expect(Number(maxHp.value)).toBe(expected);

    const slider = el.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '50';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('.result .sub')?.textContent).toContain(
      `${Math.round(expected / 2)}/${expected} HP`,
    );
  });

  it('opens at the level an encounter row links with', () => {
    const { el } = render({ dex: '25', level: '7' });
    const level = el.querySelector('input[type="number"]') as HTMLInputElement;
    expect(Number(level.value)).toBe(7);
    const maxHp = [...el.querySelectorAll('input[type="number"]')][1] as HTMLInputElement;
    expect(Number(maxHp.value)).toBe(gen1Stat({ stat: 'hp', base: PIKACHU_BASE.hp, level: 7, iv: 7 }));
  });

  it('renders the ball × status comparison with a best cell', () => {
    const { el } = render({ dex: '25' });
    expect(el.querySelectorAll('tbody tr')).toHaveLength(GEN1_MECHANICS.capture.balls.length);
    expect(el.querySelector('td.best')).not.toBeNull();
  });

  it('lists the Bulbapedia sources the rules come from', () => {
    const { el } = render();
    expect(el.querySelector('.sources')?.textContent).toContain('Catch rate on Bulbapedia');
  });

  it('explains that a generation without a module has no calculator yet', () => {
    const { el } = render({ game: 'crystal' });
    expect(el.querySelector('.status')?.textContent).toContain('have not been written yet');
  });
});

describe('IvToolPage (plan §13.11)', () => {
  beforeEach(setUp);
  afterEach(() => TestBed.resetTestingModule());

  function render(dex = '25') {
    const fixture = TestBed.createComponent(IvToolPage);
    fixture.componentRef.setInput('game', 'red');
    fixture.componentRef.setInput('dex', dex);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function typeStats(
    fixture: ReturnType<typeof render>['fixture'],
    el: HTMLElement,
    level: number,
    stats: number[],
  ) {
    const inputs = [...el.querySelectorAll('table.readings input[type="number"]')] as HTMLInputElement[];
    inputs[0]!.value = String(level);
    inputs[0]!.dispatchEvent(new Event('input'));
    stats.forEach((value, index) => {
      const input = inputs[index + 1]!;
      input.value = String(value);
      input.dispatchEvent(new Event('input'));
    });
    fixture.detectChanges();
  }

  it('titles itself with the generation’s IV system', () => {
    const { el } = render();
    expect(el.querySelector('h1')?.textContent).toBe('DV calculator');
  });

  it('narrows the DVs to one set from a level 100 summary screen', () => {
    const { fixture, el } = render();
    const dvs = { atk: 8, def: 13, spc: 9, spe: 5 };
    const level = 100;
    typeStats(fixture, el, level, [
      gen1Stat({ stat: 'hp', base: 35, level, iv: gen1HpDv(dvs.atk, dvs.def, dvs.spe, dvs.spc) }),
      gen1Stat({ stat: 'atk', base: 55, level, iv: dvs.atk }),
      gen1Stat({ stat: 'def', base: 30, level, iv: dvs.def }),
      gen1Stat({ stat: 'spc', base: 50, level, iv: dvs.spc }),
      gen1Stat({ stat: 'spe', base: 90, level, iv: dvs.spe }),
    ]);

    expect(el.querySelector('.result .headline')?.textContent).toContain('Exactly one');
    const values = [...el.querySelectorAll('.result tbody td')].map((td) => td.textContent?.trim());
    expect(values).toEqual(['7', '8', '13', '9', '5']);
    expect(el.querySelector('.shiny .headline')?.textContent).toBe('No');
  });

  it('flags stats no DV set can produce', () => {
    const { fixture, el } = render();
    typeStats(fixture, el, 50, [999]);
    expect(el.querySelector('.result .headline')?.textContent).toContain('No DV set matches');
  });

  it('reports a Shiny DV set', () => {
    const { fixture, el } = render();
    const level = 100;
    typeStats(fixture, el, level, [
      gen1Stat({ stat: 'hp', base: 35, level, iv: gen1HpDv(14, 10, 10, 10) }),
      gen1Stat({ stat: 'atk', base: 55, level, iv: 14 }),
      gen1Stat({ stat: 'def', base: 30, level, iv: 10 }),
      gen1Stat({ stat: 'spc', base: 50, level, iv: 10 }),
      gen1Stat({ stat: 'spe', base: 90, level, iv: 10 }),
    ]);
    expect(el.querySelector('.shiny .headline')?.textContent).toBe('Yes');
  });

  it('adds and removes readings', () => {
    const { fixture, el } = render();
    expect(el.querySelectorAll('table.readings tbody tr')).toHaveLength(1);
    const add = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Add a reading'),
    )!;
    add.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('table.readings tbody tr')).toHaveLength(2);

    const remove = el.querySelector('table.readings button[aria-label="Remove reading 2"]') as HTMLElement;
    remove.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('table.readings tbody tr')).toHaveLength(1);
  });

  it('explains the Shiny transfer rule', () => {
    const { el } = render();
    expect(el.querySelector('.shiny h2')?.textContent).toBe('Shiny if moved to Generation II');
    expect(el.querySelector('.shiny')?.textContent).toContain('tall grass');
  });
});
