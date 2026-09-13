import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routerFeatures } from './app.config';
import { routes } from './app.routes';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes, ...routerFeatures)],
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
});
