import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';

/** Shared with tests. Pages under `/:game` read the parent `game` param as an input. */
export const routerFeatures = [
  withComponentInputBinding(),
  withRouterConfig({ paramsInheritanceStrategy: 'always' }),
  withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
  withViewTransitions(),
] as const;

// Zoneless change detection is the default in Angular 22 (no zone.js dependency).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, ...routerFeatures),
    provideHttpClient(withFetch()),
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    // Offline support (plan §13.10). Registered once the app is stable, so it never competes with the
    // first load; production builds only.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
