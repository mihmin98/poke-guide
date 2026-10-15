import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { DEFAULT_SETTINGS } from '../../core/domain/persisted-state';
import { SettingsStore } from '../../core/settings/settings.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage (plan §11.4)', () => {
  let settings: SettingsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    settings = TestBed.inject(SettingsStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  /** The slide toggle's switch in the row with this label; it must be labelled by that text. */
  const toggle = (el: HTMLElement, label: string) => {
    const text = [...el.querySelectorAll('.label')].find((l) => l.textContent?.trim() === label);
    expect(text, label).toBeTruthy();
    const button = text!.closest('.setting')!.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(button.getAttribute('aria-labelledby')).toContain(text!.id);
    return button;
  };

  it('shows the stored values', async () => {
    settings.set('showRates', false);
    settings.set('spriteScale', 3);
    const { el } = await render();
    expect(toggle(el, 'Encounter rates').getAttribute('aria-checked')).toBe('false');
    expect(toggle(el, 'Catch rates').getAttribute('aria-checked')).toBe('true');
    expect(toggle(el, 'Larger sprites').getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector<HTMLSelectElement>('#sort')!.value).toBe('national');
  });

  it('writes each toggle to its setting', async () => {
    const { fixture, el } = await render();
    toggle(el, 'Compact rows').click();
    toggle(el, 'Larger sprites').click();
    toggle(el, 'Locations with no Pokémon').click();
    toggle(el, 'Story steps in the guide').click();
    await fixture.whenStable();
    expect(settings.settings()).toMatchObject({
      compactRows: true,
      spriteScale: 3,
      showEmptyLocations: true,
      guideShowStory: false,
    });
    expect(toggle(el, 'Compact rows').getAttribute('aria-checked')).toBe('true');
  });

  it('switches the theme and the checklist sort', async () => {
    const { fixture, el } = await render();
    const dark = [...el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')].find((b) =>
      b.textContent?.includes('Dark'),
    )!;
    dark.click();
    const sort = el.querySelector<HTMLSelectElement>('#sort')!;
    sort.value = 'walkthrough';
    sort.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(settings.settings().theme).toBe('dark');
    expect(settings.settings().checklistSort).toBe('walkthrough');
  });

  it('resets everything to the defaults', async () => {
    settings.set('theme', 'light');
    settings.set('showCatchRates', false);
    const { fixture, el } = await render();
    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Reset settings'))!
      .click();
    await fixture.whenStable();
    expect(settings.settings()).toEqual(DEFAULT_SETTINGS);
  });
});
