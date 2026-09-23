import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routerFeatures } from './app.config';
import { routes } from './app.routes';
import { SettingsStore } from './core/settings/settings.store';
import { STATE_STORAGE } from './core/storage/storage.service';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: STATE_STORAGE, useValue: null },
        provideRouter(routes, ...routerFeatures),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    document.documentElement.className = '';
  });

  async function render(url: string) {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the brand and main navigation', async () => {
    const el = await render('/games');
    expect(el.querySelector('.brand')?.textContent).toContain('Poké Guide');
    const labels = [...el.querySelectorAll('.nav-item span')].map((s) => s.textContent?.trim());
    expect(labels).toEqual(['Guide', 'Checklist', 'Profiles', 'More']);
  });

  it('applies the game theme and game links for /:game routes', async () => {
    const el = await render('/yellow/guide');
    expect(document.documentElement.classList.contains('game-yellow')).toBe(true);
    expect(el.querySelector('.game-chip')?.textContent).toContain('Yellow');
    const guide = el.querySelector<HTMLAnchorElement>('.nav-item[aria-current="page"]');
    expect(guide?.getAttribute('href')).toBe('/yellow/guide');
  });

  it('redirects unknown games to the game picker', async () => {
    await render('/green/guide');
    expect(TestBed.inject(Router).url).toBe('/games');
  });

  it('applies the theme setting to <html>, leaving "system" to the OS', async () => {
    const metas = (['light', 'dark'] as const).map((scheme) => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.media = `(prefers-color-scheme: ${scheme})`;
      return document.head.appendChild(meta);
    });
    await render('/games');
    expect(metas.map((m) => m.content)).toEqual(['#f9ebe9', '#251e1d']);
    const root = document.documentElement.classList;
    expect([root.contains('theme-light'), root.contains('theme-dark')]).toEqual([false, false]);

    const settings = TestBed.inject(SettingsStore);
    settings.set('theme', 'dark');
    TestBed.tick();
    expect([root.contains('theme-light'), root.contains('theme-dark')]).toEqual([false, true]);
    // The browser chrome follows the forced theme whatever the OS scheme is.
    expect(metas.map((m) => m.content)).toEqual(['#251e1d', '#251e1d']);

    settings.set('theme', 'light');
    TestBed.tick();
    expect([root.contains('theme-light'), root.contains('theme-dark')]).toEqual([true, false]);
    metas.forEach((m) => m.remove());
  });
});
