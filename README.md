# Poké Guide

A companion web app for catching every Pokémon you can get **without trading with another player**. Area by area and in walkthrough order, it shows which Pokémon you can find, along with their levels, rates, types and catch rates. It also keeps a checklist of what you've caught.

**Live site:** https://mihmin98.github.io/poke-guide/

Games: Red, Blue and Yellow; Gold, Silver and Crystal. FireRed/LeafGreen and Emerald are planned.

## Features

- **Guide:** every location in walkthrough order, with encounter tables per method and time of day, static encounters, gifts, in-game trades and the items found there.
- **Checklist:** the Pokémon each game can obtain without trading. Exclusive choices (starter, fossil, Hitmonlee or Hitmonchan) count towards a separate "max in one save" figure. Every Pokémon you can't obtain shows the reason.
- **Profiles:** several named playthroughs, saved in your browser. Track catches and items picked up. Move a profile to another device with a short export code, a share link or a QR code, or with a JSON backup.
- **Tools:** a catch chance calculator and an IV/DV calculator that follow each generation's own formulas.
- **Offline:** an installable PWA. After the first visit, the games you've opened keep working without a connection.

## Development

Requires Node 26.8.2 (see `.nvmrc`).

```bash
npm ci
npm start          # http://localhost:4200
npm run verify     # theme and fonts checks, lint, typecheck, all tests, production build
```

Stack: TypeScript, Angular 22 (standalone, signals, zoneless), Angular Material 3, Vitest. The design lives in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) and the current status in [`PROGRESS.md`](PROGRESS.md).

## Data pipeline

The app never calls Bulbapedia. A build-time pipeline (`scripts/data/`) does that:

1. It fetches the location and species pages through the MediaWiki API.
2. It parses the encounter templates and applies curated overrides and documented patches.
3. It validates the result, then writes `public/data/<group>.json`.
4. It downloads the sprites to `public/sprites/`.

The data files and sprites are committed.

```bash
npm run data:build      # build every version group, using the on-disk cache (--group rby for one)
npm run data:refresh    # the same, refetching every page
npm run data:offline    # from fixtures and cache only
npm run data:sprites    # download the sprite sets
npm run data:validate   # check the committed data files (no network)
```

The scraper is deliberately polite: it batches titles, waits a random 2–5 s between requests, sends `maxlag=5` and a descriptive User-Agent, and keeps a local cache.

## Adding a game

Games are added as data and configuration, not app changes: a registry entry, a version-group config with ordered locations and overrides, and, for a new generation, a mechanics module. See [plan §19](IMPLEMENTATION_PLAN.md#19-adding-a-new-game--checklist-and-roadmap).

## Deployment

GitHub Actions builds and publishes the site to GitHub Pages:

- **`deploy.yml`:** runs when a release tag (`v1.2.3`) is pushed, so the live site is always a released version. It checks that the tag matches `package.json`, then runs the full `verify` first.
- **`ci.yml`:** checks pull requests and every branch push.
- **`data-refresh.yml`:** run by hand. It refetches the data and opens a pull request when something changed; it never merges on its own.

## Versioning

Poké Guide follows [Semantic Versioning](https://semver.org/) from the user's side: a major version only when saved profiles, export codes, backups or links would stop working, a minor version for new games and features, and a patch version for fixes and data corrections. Changes are listed in [`CHANGELOG.md`](CHANGELOG.md); the rules and the release steps are in [plan §17.1](IMPLEMENTATION_PLAN.md#171-versioning-and-releases).

## Credits and disclaimer

Encounter data comes from [Bulbapedia](https://bulbapedia.bulbagarden.net/) and is licensed under [CC BY-NC-SA 2.5](https://creativecommons.org/licenses/by-nc-sa/2.5/); the data derived from it is shared under the same terms. Sprites come from Bulbagarden Archives.

Poké Guide is an unofficial fan project. It is not affiliated with or endorsed by Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon names and sprites are © Nintendo, Creatures and GAME FREAK.
