import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { decodeProfile } from '../../core/domain/export-codec';
import type { Profile } from '../../core/domain/models';
import { SettingsStore } from '../../core/settings/settings.store';
import { STATE_STORAGE } from '../../core/storage/storage.service';
import { ExportDialog, type ExportDialogData } from './export-dialog';

const PROFILE: Profile = {
  id: 'a',
  name: 'Red run',
  game: 'red',
  caught: [1, 4, 7],
  progressPart: 3,
  createdAt: '',
  updatedAt: '',
};

describe('ExportDialog (plan §12.3)', () => {
  let copied: string[];
  let settings: SettingsStore;

  beforeEach(() => {
    copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          copied.push(text);
          return Promise.resolve();
        },
      },
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: { profile: PROFILE } satisfies ExportDialogData },
      ],
    });
    settings = TestBed.inject(SettingsStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(ExportDialog);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows a code that decodes back to the profile', () => {
    const { el } = render();
    const code = el.querySelector<HTMLTextAreaElement>('textarea')!.value;
    const result = decodeProfile(code);
    expect(result.ok && result.value).toMatchObject({
      name: 'Red run',
      game: 'red',
      caught: [1, 4, 7],
      progressPart: 3,
    });
  });

  it('copies the code, and clears the save-reminder counter', async () => {
    settings.set('changesSinceExport', 40);
    const { fixture, el } = render();

    el.querySelector<HTMLButtonElement>('.actions button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(copied[0]?.startsWith('PKG1-')).toBe(true);
    expect(settings.settings().changesSinceExport).toBe(0);
    expect(el.querySelector('.status')?.textContent).toContain('Copied');
  });

  it('copies a share link that carries the code in the fragment', async () => {
    const { fixture, el } = render();
    [...el.querySelectorAll<HTMLButtonElement>('.actions button')]
      .find((button) => button.textContent?.includes('Copy link'))!
      .click();
    await fixture.whenStable();

    const link = copied[0]!;
    expect(link).toContain('/import#PKG1-');
    expect(decodeProfile(new URL(link).hash.slice(1)).ok).toBe(true);
  });

  it('shows the share link as a QR code on request', async () => {
    const { fixture, el } = render();
    expect(el.querySelector('svg.qr')).toBeNull();
    const button = [...el.querySelectorAll<HTMLButtonElement>('.actions button')].find((b) =>
      b.textContent?.includes('QR code'),
    )!;
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    await fixture.whenStable();
    const svg = el.querySelector('svg.qr')!;
    expect(svg.getAttribute('aria-label')).toBe('QR code of the share link');
    // A link of this length needs a version 5–7 code (37–45 modules) plus the quiet zone.
    const size = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    expect(size).toBeGreaterThanOrEqual(37 + 8);
    expect(size).toBeLessThanOrEqual(45 + 8);
    expect(svg.querySelector('path')!.getAttribute('d')).toMatch(/^M\d/);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    fixture.detectChanges();
    expect(el.querySelector('svg.qr')).toBeNull();
  });
});
