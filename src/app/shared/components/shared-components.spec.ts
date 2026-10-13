import { TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { ProfileStore } from '../../core/profiles/profile.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { CatchToggle } from './catch-toggle';
import { ConditionChips } from './condition-chips';
import { LevelRange, formatLevels, formatLevelValues } from './level-range';
import { MethodIcon } from './method-icon';
import { ProgressRing, progressFraction } from './progress-ring';
import { RateDisplay, formatRate, rarityPips } from './rate';
import { Sprite } from './sprite';
import { TypeBadge } from './type-badge';

function render<T>(component: Type<T>, inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(component);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('shared components (plan §13.4–13.5)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: STATE_STORAGE, useValue: null }] });
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('Sprite', () => {
    it('uses the game sprite set and a zero-padded dex number', () => {
      const { el } = render(Sprite, { dex: 6, game: 'yellow', name: 'Charizard' });
      const img = el.querySelector('img')!;
      expect(img.getAttribute('src')).toBe('sprites/gen1-y/006.png');
      expect(img.alt).toBe('Charizard');
      expect(img.getAttribute('width')).toBe('56');
    });

    it('marks uncaught sprites so they render as silhouettes', () => {
      const { fixture, el } = render(Sprite, { dex: 1, game: 'red', dimmed: true });
      expect((el as HTMLElement).getAttribute('data-dimmed')).toBe('true');
      fixture.componentRef.setInput('dimmed', false);
      fixture.detectChanges();
      expect((el as HTMLElement).getAttribute('data-dimmed')).toBe('false');
    });

    it('shows a same-size placeholder when the image fails to load', () => {
      const { fixture, el } = render(Sprite, { dex: 25, game: 'red', name: 'Pikachu', size: 40 });
      el.querySelector('img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(el.querySelector('img')).toBeNull();
      const placeholder = el.querySelector<HTMLElement>('.placeholder')!;
      expect(placeholder.getAttribute('role')).toBe('img');
      expect(placeholder.getAttribute('aria-label')).toBe('Pikachu');
      expect(placeholder.getAttribute('aria-hidden')).toBeNull();
      expect(placeholder.style.width).toBe('40px');
      expect(placeholder.style.height).toBe('40px');
    });

    it('hides the placeholder of a decorative sprite from assistive technology', () => {
      const { fixture, el } = render(Sprite, { dex: 25, game: 'red' });
      el.querySelector('img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      const placeholder = el.querySelector('.placeholder')!;
      expect(placeholder.getAttribute('aria-hidden')).toBe('true');
      expect(placeholder.getAttribute('aria-label')).toBeNull();
    });

    it('tries the image again when the browser comes back online', () => {
      const { fixture, el } = render(Sprite, { dex: 25, game: 'red' });
      el.querySelector('img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      window.dispatchEvent(new Event('online'));
      fixture.detectChanges();
      expect(el.querySelector('.placeholder')).toBeNull();
      expect(el.querySelector('img')).not.toBeNull();
    });

    it('resets the failed state for a different sprite', () => {
      const { fixture, el } = render(Sprite, { dex: 25, game: 'red' });
      el.querySelector('img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      fixture.componentRef.setInput('dex', 26);
      fixture.detectChanges();
      expect(el.querySelector('img')!.getAttribute('src')).toBe('sprites/gen1-rb/026.png');
    });
  });

  it('TypeBadge shows the label and the generated type tokens', () => {
    const { el, fixture } = render(TypeBadge, { type: 'poison' });
    expect(el.textContent?.trim()).toBe('Poison');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--type-color')).toBe('var(--type-poison)');
    expect(host.style.getPropertyValue('--type-on-color')).toBe('var(--type-poison-on)');
  });

  describe('LevelRange', () => {
    it('formats single levels, ranges and gapped ranges', () => {
      expect(formatLevels(null)).toBe('');
      expect(formatLevels({ min: 5, max: 5 })).toBe('Lv 5');
      expect(formatLevels({ min: 2, max: 5 })).toBe('Lv 2–5');
      expect(formatLevelValues({ min: 8, max: 12, values: [8, 10, 12] })).toBe('8, 10, 12');
      expect(formatLevelValues({ min: 2, max: 5 })).toBeNull();
    });

    it('lists the exact levels of a gapped range for tooltips and screen readers', () => {
      const { el } = render(LevelRange, { levels: { min: 8, max: 12, values: [8, 10, 12] } });
      expect(el.textContent).toContain('Lv 8–12');
      expect(el.querySelector('[title]')?.getAttribute('title')).toBe('8, 10, 12');
      expect(el.querySelector('.sr-only')?.textContent).toContain('8, 10, 12');
    });

    it('shows a dash when the levels are unknown', () => {
      const { el } = render(LevelRange, { levels: null });
      expect(el.textContent?.trim()).toBe('—');
    });
  });

  describe('RateDisplay', () => {
    it('formats every rate kind', () => {
      expect(formatRate({ kind: 'percent', value: 12 })).toBe('12%');
      expect(formatRate({ kind: 'once' })).toBe('One');
      expect(formatRate({ kind: 'price', value: 500 })).toBe('₽500');
      expect(formatRate({ kind: 'coins', value: 1200 })).toBe('1,200 coins');
      expect(formatRate({ kind: 'unknown', text: 'Varies' })).toBe('Varies');
    });

    it('buckets percentages into rarity pips', () => {
      expect([1, 4, 5, 10, 15, 30, 55].map(rarityPips)).toEqual([1, 1, 2, 3, 4, 5, 5]);
    });

    it('draws the rarity bar only for percentages', () => {
      const { el } = render(RateDisplay, { rate: { kind: 'percent', value: 20 } });
      expect(el.querySelector('.text')?.textContent?.trim()).toBe('20%');
      expect(el.querySelectorAll('.pip').length).toBe(5);
      expect(el.querySelectorAll('.pip.on').length).toBe(4);
      expect(el.querySelector('.bar')?.getAttribute('aria-label')).toBe('Common');

      const once = render(RateDisplay, { rate: { kind: 'once' } });
      expect(once.el.querySelector('.bar')).toBeNull();
    });
  });

  describe('ConditionChips', () => {
    const conditions = [
      { kind: 'time', value: 'night' },
      { kind: 'swarm' },
      { kind: 'story', text: 'After the Rocket Hideout' },
    ];

    it('leaves out conditions rendered as table columns by default', () => {
      const { el } = render(ConditionChips, { conditions });
      const texts = [...el.querySelectorAll('.chip')].map((c) => c.textContent?.trim());
      expect(texts).toEqual(['Swarm', 'After the Rocket Hideout']);
    });

    it('includes column conditions on request', () => {
      const { el } = render(ConditionChips, { conditions, includeColumns: true });
      expect([...el.querySelectorAll('.chip')].map((c) => c.textContent?.trim())).toEqual([
        'Night',
        'Swarm',
        'After the Rocket Hideout',
      ]);
    });

    it('renders nothing without conditions', () => {
      const { el } = render(ConditionChips, { conditions: undefined });
      expect(el.querySelectorAll('.chip').length).toBe(0);
    });
  });

  describe('MethodIcon', () => {
    it('takes the icon and label from the method registry', () => {
      const { el } = render(MethodIcon, { method: 'fish-super', showLabel: true });
      expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe('phishing');
      expect(el.querySelector('.label')?.textContent?.trim()).toBe('Super Rod');
    });

    it('labels the icon itself when there is no visible label', () => {
      const { el } = render(MethodIcon, { method: 'surf' });
      expect(el.querySelector('mat-icon')?.getAttribute('aria-label')).toBe('Surfing');
      expect(el.querySelector('.label')).toBeNull();
    });

    it('falls back to a generic icon for a method the app does not know', () => {
      const { el } = render(MethodIcon, { method: 'no-such-method', showLabel: true });
      expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe('help');
      expect(el.querySelector('.label')?.textContent?.trim()).toBe('no-such-method');
    });
  });

  describe('ProgressRing', () => {
    it('clamps the fraction', () => {
      expect(progressFraction(0, 0)).toBe(0);
      expect(progressFraction(5, 10)).toBe(0.5);
      expect(progressFraction(20, 10)).toBe(1);
      expect(progressFraction(-1, 10)).toBe(0);
    });

    it('announces the count and shrinks the dash offset as progress grows', () => {
      const { fixture, el } = render(ProgressRing, { value: 87, total: 148 });
      expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('87 of 148 caught');
      const offset = () => Number(el.querySelector('.bar')!.getAttribute('stroke-dashoffset'));
      const before = offset();
      fixture.componentRef.setInput('value', 148);
      fixture.detectChanges();
      expect(offset()).toBeLessThan(before);
      expect(offset()).toBeCloseTo(0);
    });
  });

  describe('CatchToggle', () => {
    let profiles: ProfileStore;

    beforeEach(() => {
      profiles = TestBed.inject(ProfileStore);
    });

    const button = (el: HTMLElement) => el.querySelector('button')!;

    it('is disabled without a profile', () => {
      const { el } = render(CatchToggle, { dex: 16, game: 'red', name: 'Pidgey' });
      expect(button(el).disabled).toBe(true);
      expect(button(el).title).toContain('Create a profile');
    });

    it('is disabled when the active profile is for another game', () => {
      profiles.createProfile('Blue run', 'blue');
      const { el } = render(CatchToggle, { dex: 16, game: 'red', name: 'Pidgey' });
      expect(button(el).disabled).toBe(true);
      expect(button(el).title).toContain('another game');
    });

    it('toggles the active profile and reflects the state', () => {
      profiles.createProfile('Red run', 'red');
      const { fixture, el } = render(CatchToggle, { dex: 16, game: 'red', name: 'Pidgey' });
      expect(button(el).getAttribute('aria-checked')).toBe('false');
      expect(button(el).getAttribute('aria-label')).toBe('Pidgey, not caught');

      button(el).click();
      fixture.detectChanges();
      expect(profiles.isCaught(16)).toBe(true);
      expect(button(el).getAttribute('aria-checked')).toBe('true');
      expect(button(el).getAttribute('aria-label')).toBe('Pidgey, caught');
      expect(profiles.lastChange()?.label).toBe('Caught Pidgey');

      button(el).click();
      fixture.detectChanges();
      expect(profiles.isCaught(16)).toBe(false);
      expect(profiles.lastChange()?.label).toBe('Uncaught Pidgey');
    });
  });
});
