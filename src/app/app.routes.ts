import { Routes } from '@angular/router';
import { homeRedirect } from './core/routing/home-redirect';
import { gameGuard } from './core/routing/game.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: homeRedirect },
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
    // A share link is `/import#PKG1-…`: the code rides in the fragment, never reaching a server.
    path: 'import',
    title: 'Import · Poké Guide',
    loadComponent: () => import('./features/import/import.page').then((m) => m.ImportPage),
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
        path: 'welcome',
        title: 'Welcome · Poké Guide',
        loadComponent: () =>
          import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage),
      },
      {
        // The location page is a child, so ≥ 1200 px can show the list and the detail side by side
        // (plan §13.2). Narrower screens hide the list while a location is open.
        path: 'guide',
        title: 'Guide · Poké Guide',
        loadComponent: () => import('./features/guide/guide.page').then((m) => m.GuidePage),
        children: [
          {
            path: ':locationId',
            title: 'Location · Poké Guide',
            loadComponent: () =>
              import('./features/location/location.page').then((m) => m.LocationPage),
          },
        ],
      },
      {
        path: 'checklist',
        title: 'Checklist · Poké Guide',
        loadComponent: () =>
          import('./features/checklist/checklist.page').then((m) => m.ChecklistPage),
      },
      {
        // Story milestones (plan §13.12); the nav only links here for games whose data has them.
        path: 'story',
        title: 'Story · Poké Guide',
        loadComponent: () => import('./features/story/story.page').then((m) => m.StoryPage),
      },
      {
        // Generic tools driven by the version group's `mechanicsId` (plan §13.11).
        path: 'tools',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'catch' },
          {
            path: 'catch',
            title: 'Catch chance · Poké Guide',
            loadComponent: () => import('./features/tools/catch.page').then((m) => m.CatchToolPage),
          },
          {
            path: 'ivs',
            title: 'IV calculator · Poké Guide',
            loadComponent: () => import('./features/tools/iv.page').then((m) => m.IvToolPage),
          },
        ],
      },
      {
        // `:key` is a species slug (`pikachu`) or a National Dex number, so links can use either.
        path: 'pokemon/:key',
        title: 'Pokémon · Poké Guide',
        loadComponent: () => import('./features/pokemon/pokemon.page').then((m) => m.PokemonPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Not found · Poké Guide',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
