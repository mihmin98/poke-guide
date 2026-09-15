import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routerFeatures } from '../../app.config';
import { routes } from '../../app.routes';
import { ProfileStore } from '../../core/profiles/profile.store';
import { SettingsStore } from '../../core/settings/settings.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { SaveReminder, SAVE_REMINDER_AFTER } from './save-reminder';

describe('SaveReminder (plan §13.8)', () => {
  let profiles: ProfileStore;
  let settings: SettingsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        provideRouter(routes, ...routerFeatures),
      ],
    });
    profiles = TestBed.inject(ProfileStore);
    settings = TestBed.inject(SettingsStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(SaveReminder);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('stays hidden until enough catch changes have piled up', () => {
    profiles.createProfile('Red run', 'red');
    const { fixture, el } = render();
    expect(el.querySelector('aside')).toBeNull();

    profiles.bulkSetCaught(
      'red',
      Array.from({ length: SAVE_REMINDER_AFTER }, (_, i) => i + 1),
      true,
    );
    fixture.detectChanges();
    expect(el.querySelector('aside')?.textContent).toContain('this browser only');
  });

  it('never appears without a profile', () => {
    settings.set('changesSinceExport', 100);
    const { el } = render();
    expect(el.querySelector('aside')).toBeNull();
  });

  it('dismissing restarts the count', () => {
    profiles.createProfile('Red run', 'red');
    settings.set('changesSinceExport', SAVE_REMINDER_AFTER);
    const { fixture, el } = render();

    el.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('aside')).toBeNull();
    expect(settings.settings().changesSinceExport).toBe(0);
  });
});
