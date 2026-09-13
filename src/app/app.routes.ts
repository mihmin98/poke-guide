import { Routes } from '@angular/router';
import { gameGuard } from './core/routing/game.guard';

export const routes: Routes = [
  // Phase 2: redirect to the active profile's game instead.
  { path: '', pathMatch: 'full', redirectTo: 'games' },
  {
    path: 'games',
    title: 'Games · Poké Guide',
    loadComponent: () => import('./features/games/game-picker.page').then((m) => m.GamePickerPage),
  },
  {
    path: 'profiles',
    title: 'Profiles · Poké Guide',
    loadComponent: () => import('./features/profiles/profiles.page').then((m) => m.ProfilesPage),
  },
  {
    path: 'settings',
    title: 'Settings · Poké Guide',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'about',
    title: 'About · Poké Guide',
    loadComponent: () => import('./features/about/about.page').then((m) => m.AboutPage),
  },
  {
    path: ':game',
    canActivate: [gameGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'guide' },
      {
        path: 'guide',
        title: 'Guide · Poké Guide',
        loadComponent: () => import('./features/guide/guide.page').then((m) => m.GuidePage),
      },
      {
        path: 'checklist',
        title: 'Checklist · Poké Guide',
        loadComponent: () =>
          import('./features/checklist/checklist.page').then((m) => m.ChecklistPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Not found · Poké Guide',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
