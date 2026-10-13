import { InjectionToken, isDevMode } from '@angular/core';

/**
 * Whether `planned` games can be opened. Only dev builds open them, so work-in-progress games can be built and
 * checked; a release never ships one as playable. The picker still lists them as "Coming Soon".
 */
export const PLANNED_GAMES_OPEN = new InjectionToken<boolean>('PLANNED_GAMES_OPEN', {
  providedIn: 'root',
  factory: () => isDevMode(),
});
