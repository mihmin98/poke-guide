# Progress Tracker

This is the resume point for the project. **Read it at the start of every session and update it before stopping.**

How to use it:
1. Read **Current status** and **Next step**, then open the section of `IMPLEMENTATION_PLAN.md` referenced by that task.
2. While working, tick checkboxes (`[x]`). Mark partly done work as `[~]` with a short note.
3. Before ending a session:
   - Update **Current status** and **Next step**.
   - Add any new **Decisions** or **Open questions**.
   - Append a line to **Session log**, including verification state (tests passing? data build clean?).
4. If the implementation departs from the plan, update the plan too, and record why under **Decisions**.

---

## Current status

- **Phase:** Phase 0 complete. **Phase 1 in progress.** Done:
  - Parsing core, `entry1`/`entry2` adapters, walker, merge, and the ordered `rby` location config.
  - Species master data: National Dex list, Gen I type history, slugs.
  - Species pages: infobox extras, base stats by generation, Pokédex entries.
  - Gen I learnsets and move data (plan §7.12, added at the user's request).
  - The authoritative Gen I evolution graph, plus the evolution-box diff (warnings only).
  - `scripts/data/build.ts` + `core/assemble.ts`: the first generated `public/data/rby.json` and `rby.pokedex.json`, with golden assertions.
- **Last updated:** 2026-09-13
- **Repo state:** `npm run verify` passes (theme check, lint, scripts typecheck, 211 pipeline tests, 14 app tests, production build). `npm run data:build` gives 0 errors, 9 warnings and 3 notes: 151 species, 57 locations, 739 encounters, 164 moves. It writes `public/data/rby.json` (244 KB, 21 KB gzipped) and `public/data/rby.pokedex.json` (203 KB, 27 KB gzipped) for the user to commit. The data doesn't include shop prizes, in-game trades from the trade page, statics, exclusive groups, unlocks or event-only species yet (those override tasks are still open). Golden tests read the generated files, so rerun `npm run data:build` after pipeline changes. A smoke run of the species, learnset and move parsers over all 151 cached species pages and 151 learnset subpages had 0 problems: 164 moves, 55 TMs/HMs, no conflicts. Nothing is written to `public/data/` yet (that's `build.ts`).
- **Environment:** Node 26.8.2 via **nvm** (pinned in `.nvmrc` and `.node-version`). Node is already on the PATH in Bash tool shells: run `node`/`npm`/`npx` directly, with no `nvm.sh` sourcing and no PATH export. The raw page cache is `scripts/data/cache/raw/` (gitignored). It now also holds all 151 species pages and Gen I learnset subpages.

## Next step

Phase 1. Done this session: catch-rate history, evolution-box diff and the `build.ts` wiring (see the session log). Next, in this order:
1. **Items per area with prerequisites** (user requirement, 2026-09-13, not designed yet): list the **items found in each area** and their **prerequisites** (e.g. Surf, Cut, Strength, an event or badge).
   - Research where Bulbapedia keeps this, e.g. an `Items` section on location pages with `{{itlist}}`-style templates, and walkthrough pages (open question 13).
   - Then write plan §7.13 (parsing, prerequisite vocabulary, data model, output file) and add tasks to the Phase 1, 3 and 4 checklists before implementing.
2. Shop (Game Corner) and trade parsers (plan §7.7). They cover most of the 8 "no Generation I section" warnings (open question 9).
3. Overrides: statics, gifts and choices (exclusive groups), unlocks, event-only, patches (Route 1 "Attacking Oak" Pikachu → `starter`, open question 10). `assembleVersionGroup` currently writes empty `unlocks`, `exclusiveGroups` and `eventOnly`.
4. Validation: zod schema for both output files, obtainability coverage for every species in every game (§9), `reports/rby.md`, and the remaining golden assertions (Game Corner windows, Mew event-only, trade evolutions unobtainable).
5. Sprite downloader (open question 1).

---

## Phase checklists (mirrors plan §16)

### Phase 0 — Environment and scaffold (local only)
- [x] Install Node (nvm, 26.8.2), add `.nvmrc` + `.node-version`
- [x] `.gitignore` file (including `scripts/data/cache/`). Don't run git commands; the user handles git.
- [x] Angular 22 scaffold (standalone, zoneless, SCSS, routing, no SSR, Vitest), Angular Material (M3), ESLint (angular-eslint), Prettier, strict TS (`noUncheckedIndexedAccess`)
- [x] `tsconfig.scripts.json` + `tsx`, so `scripts/` can import `src/app/core/{domain,games,mechanics}` (`npm run typecheck:scripts`). ESLint forbids Angular/rxjs imports in those folders.
- [x] `core/games/registry.ts`: red/blue/yellow `available`; crystal/firered/leafgreen/emerald `planned`. Methods and conditions registries, plus `pokemon-types.ts`. Integrity tests in `registry.spec.ts`.
- [x] Theme generator (`npm run theme:games`) → `src/theme/game-themes.generated.scss` + `type-colors.generated.scss` (`--check` mode runs in `verify`)
- [x] Shell app: routing with `gameGuard`, lazy placeholder pages, game picker, bottom nav (< 600 px) / nav rail, per-game class on `<html>`, attribution footer and About page
- [x] `npm run verify` (theme check + lint + scripts typecheck + scripts tests + app tests + build)
- [x] Update the Commands section of `CLAUDE.md` with the real scripts
- [x] Manual visual check of `npm start` (user confirmed 2026-09-13)
- **Accept when:** `ng serve` shows the shell with per-game theming, and `npm run verify` passes.

### Phase 1 — Data pipeline (plan §7)
- [x] Core: MediaWiki client, cache, tokenizer, sections, markup, levels, rates, encounter walker, merge, plus fixture tests
- [x] `CatchTemplateAdapter` interface, `entry1` adapter, adapter contract test suite
- [x] Extensibility spike: `entry2` adapter (tests only) passing the contract suite on a Gold/Silver/Crystal fixture
- [x] `version-groups/rby/`: config, ordered locations (plan §10), cross-check against the category. Done: config, 57 locations, walkthrough parts, category snapshot test, and the live category check in `build.ts` (the offline build uses the snapshot).
- [x] Species list, type history (Gen I), evolution override plus parsed diff.
  - Done: `core/species-list.ts` (skips `????` placeholders), `core/type-history.ts` (`typesInGeneration`, `typeExistsIn`), and `overrides/evolutions.ts`. The override has 72 edges and was checked once against all 151 evolution boxes.
  - Done: `core/evolution-boxes.ts` diffs the boxes against the override (0 warnings over all 151 cached pages). Wiring into `build.ts` is part of the `build.ts` task.
- [~] Species-page parsing (catch rate, base stats with generation ranges), catch-rate history with classified notes, read the `Stat` page.
  - Done: `core/species-pages.ts` reads the infobox (category, height, weight, base exp, growth rate, current catch rate, EV yield, egg groups, gender code), base stats by generation (form blocks skipped) and Pokédex entries per game.
  - Done: `core/catch-rate-history.ts` (list rows, note effects, classified notes, per-game overrides).
  - Pending: the `Stat` page.
- [x] Learnsets and moves (plan §7.12): `core/learnsets.ts` covers level-up levels per game (RB vs Y), TM/HM, prior-evolution moves with game flags, and the generation's move data. `collectMoves` merges moves and fails on conflicts.
- [ ] Items per area with prerequisites (new requirement, plan §7.13 to be written): research the Bulbapedia source, then build the parser, prerequisite vocabulary and output
- [ ] Shop (Game Corner) and trade parsers, plus override fallback
- [ ] Overrides: statics, gifts and choices, unlocks, event-only, patches (each checked against Bulbapedia with its revid recorded)
- [x] `build.ts` wiring: placement/order, `sources[]`, output JSON (`rby.json` + `rby.pokedex.json`). Pure assembly lives in `core/assemble.ts`; `npm run data:build` / `data:refresh` / `data:offline` / `data:build:all`, plus `--dry-run`.
- [~] Validation, golden assertions, `reports/rby.md`. Done: build errors (missing pages, infobox vs species list and catch-rate list, catch-rate notes, learnset and move conflicts, out-of-range rows and trades, `expectEmpty`, duplicate ids) and warnings (no section, table types, evolution boxes, category). Also done: `version-groups/rby/golden.spec.ts` (structure, §7.8 encounters, §7.11 catch rates and stats, §7.12 learnsets/moves/entries). Pending: zod schema, obtainability coverage, report, and the golden assertions that need shop/overrides.
- [ ] Sprite downloader (`gen1-rb`, `gen1-y`)
- [~] Generate `public/data/rby.json`, `public/data/rby.pokedex.json` and sprites (the user commits them). Both data files are generated (without the pending overrides); sprites are pending.
- **Accept when:** 0 errors, warnings triaged, golden assertions pass, 10-location spot check matches, and every species 1–151 is either obtainable or has a documented reason in all three games.

### Phase 2 — Core domain, storage and profiles (plan §8, §9, §11, §12.1)
- [~] `models.ts` (written early; the pipeline needs it; now includes `Move`, `Learnset`, `PokedexData` and species extras), `obtainability.ts` (including synthetic breeding tests), `GameDataService` with lazy loading per version group (plus the lazily loaded `.pokedex.json`)
- [ ] `StorageService`, `migrations.ts`, `ProfileStore`, `SettingsStore`, undo
- [ ] Game picker, onboarding, profile switcher, Profiles page
- **Accept when:** you can create and switch profiles for different games, and state survives reloads and syncs across tabs.

### Phase 3 — Guide and location pages (plan §13.2–13.5)
- [ ] Shared components (sprite, type badge, level range, rate, condition chips, method icon, catch toggle, progress ring)
- [ ] Guide page (region and part sections, location cards, sprite strips, search, filters, hide completed)
- [ ] Location page (sub-area tabs, method sections, encounter/trade/prize rows, exclusive group chips, source link, previous/next, plus an items list with prerequisites)
- [ ] Desktop two-pane layout and mobile full-screen navigation with scroll restoration
- [ ] Game-mismatch banner
- **Accept when:** all locations render correctly for each game at 360 px and 1440 px, and toggles update counts immediately.

### Phase 4 — Checklist and Pokémon detail (plan §13.6–13.7)
- [ ] Checklist grid and list views, filters, sorts, summary with "max in one save", unobtainable section
- [ ] Pokémon detail (sources, other games, evolution chain with conditions, Pokédex entry, category/height/weight, growth rate, base exp, level-up and TM/HM learnsets per game)
- [ ] Bulk actions, `progressPart` selector, "Available now" filters
- **Accept when:** checklist counts match `reports/rby.md`, and every obtainable species shows at least one source.

### Phase 5 — Import and export (plan §12.2–12.4)
- [ ] `export-codec.ts` (`PKG1`) with property tests across registry games
- [ ] Export dialog (copy code, copy link, share), JSON backup download
- [ ] Import page and dialog with preview, then new or replace
- [ ] Save-reminder banner
- **Accept when:** a round-trip between two browsers reproduces the exact state, and invalid codes give clear errors.

### Phase 6 — Catch rate, stats, shiny and IV tools (plan §4.5, §7.11, §13.11)
- [ ] `core/mechanics/gen1.ts` (exact capture formula, Safari Zone modifiers, stat formula, DV rules, shiny rules, stat experience from base stats, sources)
- [ ] Catch rate in location rows. Catch rate, base stats, shiny and IV info in Pokémon detail.
- [ ] Catch-chance calculator page and quick grid
- [ ] IV/DV calculator page with the "Shiny if moved to Gen II" check
- [ ] Mechanics tests
- **Accept when:** results match hand-worked examples from Bulbapedia's formulas, and every species shows the correct Gen I catch rate and base stats.

### Phase 7 — Polish, accessibility, PWA (plan §13.1, §13.9, §13.10)
- [ ] Dark mode, generated accents checked for contrast, reduced motion
- [ ] Service worker, manifest, update prompt
- [ ] Self-host the Roboto and Material Symbols fonts (currently Google Fonts links) so the app works offline
- [ ] Optional: QR export, swipe between locations
- [ ] Manual accessibility check clean. Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95.
- **Accept when:** the app works offline after the first load, and the Lighthouse targets are met.

### Phase 8 — GitHub Pages publishing (last step, plan §17)
- [ ] The user creates the GitHub repo and pushes. Ask them for the repo name (it sets the base href).
- [ ] `ci.yml`, `deploy.yml`, `data-refresh.yml`, `404.html` + `.nojekyll`, Pages source = GitHub Actions
- [ ] Add the repo URL to the scraper User-Agent and the About page
- [ ] README (features, dev setup, data pipeline, adding a game). The current `README.md` is the Angular CLI default.
- [ ] Deploy and run the live smoke test (deep link reload, import link, offline)
- **Accept when:** the live site passes the same manual smoke check (plan §14) as the local build.

---

## Open questions and things to verify

| # | Item | Where it matters | Status |
|---|---|---|---|
| 1 | Red/Blue sprite file naming `Spr_1b_###.png` on Bulbagarden Archives (`Spr_1y_###.png` is confirmed) | Phase 1 sprites | Open |
| 2 | Yellow Squirtle gift location (Vermilion City?) | Phase 1 overrides | **Resolved:** Vermilion City, after defeating Lt. Surge (its Gen I table) |
| 3 | Fetch and review the Bulbapedia `Stat` page (formulas for the IV/DV calculator) | Phase 1 / 6 | Open. Now cached (rev 4605719), along with `Effort values` and `Experience`. |
| 4 | Angular 22 `ng new` flags and defaults (zoneless, Vitest), and the Node version it supports | Phase 0 | **Resolved:** CLI 22.1.8 requires Node `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`. Standalone, strict and Vitest are defaults; zoneless is the default runtime (no zone.js). |
| 5 | Exact single-test command with the Angular Vitest builder, then update `CLAUDE.md` | Phase 0 | **Resolved:** `npx ng test --watch=false --include <file-or-dir> --filter "<regex>"`; pipeline tests use `npx vitest run --config vitest.scripts.config.ts <file> -t "<name>"` |
| 6 | Route 22 is listed in Part 2 (reachable early) rather than Part 15 as in the walkthrough. Keep it? | Phase 1 locations | Assumed yes |
| 7 | Accent seeds for planned games (Crystal `#4FB8D6`, FireRed `#F15A22`, LeafGreen `#4E9A3A`, Emerald `#00A86B`) were picked without a source. Revisit when each game is added. | Later games | Open |
| 8 | npm 11 skipped install scripts for `lmdb` and `msgpackr-extract` (Angular build cache deps). Builds work; revisit only if build caching misbehaves. | Tooling | Open |
| 9 | Pages with no Gen I encounter table: Pewter City, S.S. Anne, Pewter Museum, Lavender Town, Underground Path 7–8, Celadon Game Corner, Team Rocket Hideout, Saffron City. Their Pokémon (prizes, Old Amber, statics) must come from the shop/trade parsers or overrides; the build should report "no section" as a warning, and these should be triaged. | Phase 1 overrides | Open. `data:build` now reports exactly these 8 pages as warnings. |
| 10 | Route 1's Yellow "Attacking Oak" Pikachu parses as `special`; plan §7.4 wants it patched to `starter`. | Phase 1 patches | Open |
| 11 | The infobox `oldexp` field is assumed to be the Gen I–IV base experience yield (`expyield` is Gen V+). Pikachu 82, Eevee 92 and Bulbasaur 64 match Gen I values from memory. Confirm against the cached `Experience` page, or a pret disassembly, before trusting it. | Phase 1 species extras | Open |
| 13 | Items per area: where does Bulbapedia list Gen I items per location (location page `Items` sections? walkthroughs?), how are hidden items and prerequisites (HMs, badges, events) marked, and do Red/Blue and Yellow differ? | Items feature | Open |
| 12 | Learnset `N/A`/footnote handling and the `RB`/`Y` flags on prior-evolution rows were read from the page markup. Spot-check a few Yellow-specific learnsets (Pikachu, Nidoqueen, Vaporeon) against in-game data. | Phase 1 golden tests | Open |
| 15 | Plan §3.5 said Yellow's Dragonair "27" and Dragonite "9" notes are held-item values only. **pret disagrees:** `pokeyellow` `data/pokemon/base_stats/dragonair.asm` has `db 27 ; catch rate` (pokered: 45), Dragonite has 9, and `LoadEnemyMonData` copies that byte into `wEnemyMonActualCatchRate`, which `ItemUseBall` uses. So Yellow captures use 27/9. Kadabra's 96 really is post-capture only (`ld [wBoxMon1CatchRate], a` after capture), and the partner Pikachu is a gift. Needs a per-game catch rate (species field or encounter `catchRateOverride`). | Phase 1 catch rates, Phase 6 calculator | **Resolved:** `species[].catchRateByGame` (see Decisions) |
| 14 | Keep Playwright for e2e? It needs a new devDependency plus browser binaries in `~/.cache/ms-playwright` (both need user approval). Alternatives: Vitest-only (jsdom) with manual browser checks, or Playwright only in GitHub Actions CI. The user questioned whether it's needed. | Phase 3 e2e, plan §14 | **Resolved:** Vitest only, with manual browser checks (see Decisions) |

## Decisions

| Date | Decision |
|---|---|
| 2026-09-12 | Data is scraped from Bulbapedia at build time into committed JSON. No runtime fetching. |
| 2026-09-12 | Checklist counts wild, evolutions (not trade evolutions), in-game NPC trades, gifts/prizes/fossils, statics/legendaries. Exclusive choices are grouped. |
| 2026-09-12 | Multiple named profiles, each tied to one game. Import/export as a `PKG1-` code plus JSON backup. |
| 2026-09-12 | UI: Angular Material 3 with per-game accent colors. |
| 2026-09-13 | GitHub Pages publishing is the last phase. |
| 2026-09-13 | No license file in the repo (Bulbapedia attribution is still shown in the app). |
| 2026-09-13 | Catch status is binary (caught / not caught), with no "seen" state. |
| 2026-09-13 | Multi-game architecture: game registry, version groups, template adapters, no game-specific branches in app code. |
| 2026-09-13 | English only. In-game sprites. National Dex checklist with regional sort. One playthrough per profile. One copy per species. App name "Poké Guide". |
| 2026-09-13 | Include catch rates, base stats, shiny and IV info, plus catch-chance and IV/DV calculators (new Phase 6). |
| 2026-09-13 | The user handles all git operations manually (init, commits, branches, remotes, pushing, repo creation). Claude never runs git commands; scaffold with `--skip-git`. |
| 2026-09-13 | Node is managed with **nvm** (user preference), not mise/fnm. Node 26.8.2, pinned in `.nvmrc` (read by nvm) and `.node-version`. |
| 2026-09-13 | Codec ids follow international release order: red 1, blue 2, yellow 3, gold 4, silver 5, crystal 6, ruby 7, sapphire 8, emerald 9, firered 10, leafgreen 11. Gold, silver, ruby and sapphire aren't in the registry yet, but their ids are reserved. |
| 2026-09-13 | Router uses `paramsInheritanceStrategy: 'always'` so pages under `/:game` receive `game` as a component input. `routerFeatures` is exported from `app.config.ts` and reused by tests. |
| 2026-09-13 | Game themes use `SchemeFidelity` (keeps the container color close to the brand seed) and emit `light-dark()` values, so one `.game-<id>` class covers light and dark. The class is set on `<html>` so CDK overlays inherit it. |
| 2026-09-13 | Type colors live in `core/games/pokemon-types.ts`. The generator picks black or white text per type and fails if contrast is below 4.5:1. Output goes to `type-colors.generated.scss`, replacing the planned hand-written `_type-colors.scss`. |
| 2026-09-13 | Nav: one `<nav>` that CSS lays out as a bottom bar under 600 px and a rail above, with no JS breakpoints. Items: Guide · Checklist · Profiles · More (menu: Games, Settings, About). `planned` games are reachable only when `isDevMode()`. |
| 2026-09-13 | Pipeline tests run with plain Vitest in Node (`npm run test:scripts`, `vitest.scripts.config.ts`); `ng test` is restricted to `src/**/*.spec.ts` in `angular.json`. Both run in `verify`. |
| 2026-09-13 | Fixtures are readable `.wikitext` files with a one-line JSON header comment (title, resolved title, revid, timestamps), captured with `npm run data:fixtures` from `version-groups/<id>/fixture-pages.ts`. Offline mode reads fixtures before the cache. |
| 2026-09-13 | `normalizeMethod(row, ctx)` takes the whole row and walk context instead of `(raw, divLabel)`: purchases need the rate and floor labels need the location kind. Plan §7.1 updated. |
| 2026-09-13 | Fossils come from Cinnabar Lab's Gen I table (`Helix`/`Dome`/`Amber` → `fossil`). Only the exclusive group and "where the fossil is found" notes stay in overrides. Plan §7.7 updated. |
| 2026-09-13 | Indigo Plateau is not `expectEmpty`: its Gen I table has Old/Good Rod encounters in Lorelei's room. Plan §10 updated. |
| 2026-09-13 | `entry1` accepts the `all=` rate shorthand (Route 19 Magikarp). The walker warns when a Pokémon section only holds `{{main|…}}`. Generic `catch/div` group labels (Fishing, Surfing, Gift Pokémon, Special Pokémon…) are dropped; specific ones (e.g. "Attacking Oak") become the encounter `label`. |
| 2026-09-13 | **Pokédex details added at the user's request** (plan §7.12): evolution conditions, level-up and TM/HM learnsets per game, move data, Pokédex entries, category, height, weight, growth rate and base exp. They go in a separate lazily loaded `public/data/<vg>.pokedex.json` (`PokedexData`); species extras go in the main file. |
| 2026-09-13 | Learnsets come from `<Name> (Pokémon)/Generation <roman> learnset` subpages. Move type, power, accuracy and PP are taken from those rows, so they're correct for the generation (Gen I Bite is Normal). Move ids are slugs of the generation's spelling. Transfer, event, tutor (Stadium) and Move Reminder lists are ignored. |
| 2026-09-13 | EVs/IVs are not stored per species for Gen I–II: stat experience equals the defeated species' base stats, and DVs are random, so both belong in `core/mechanics`. `evYield` is stored from Gen III. |
| 2026-09-13 | Species categories use the current spelling ("Poison Moth"), not the all-caps Gen I–II in-game spellings ("POISONMOTH"). |
| 2026-09-13 | Evolution override `RBY_EVOLUTIONS` (72 edges) is written by hand and was checked once against all 151 current evolution boxes. The only differences are regional-form branches from later generations. |
| 2026-09-13 | **Items per area added at the user's request:** the guide should list the items found in each area and their prerequisites. Design pending (plan §7.13). |
| 2026-09-13 | Bash tool shells don't have Node on the PATH, and the user doesn't want `nvm.sh` sourced. Commands are prefixed with `export PATH="$HOME/.nvm/versions/node/v26.8.2/bin:$PATH"` (`CLAUDE.md` updated). **Superseded:** Node is now on the PATH in Bash tool shells, so no prefix is needed (see `CLAUDE.md`). |
| 2026-09-13 | Ask the user before adding any new dependency (including project-local `package.json` entries) or installing global packages/programs. Don't change files outside the project directory, except Claude's memory folder, the session scratchpad and tool caches like `~/.npm` (`CLAUDE.md` updated). |
| 2026-09-13 | **No Playwright / no automated e2e.** Testing is Vitest only. Browser behavior (layouts, reload persistence, sub-path deep links, accessibility) is covered by the manual smoke check in plan §14. Visual regression screenshots and the CI e2e step were dropped. Plan §13.9, §14, §16, §17 and §18 updated. |
| 2026-09-13 | **Per-game catch rates** (user choice): `Species.catchRateByGame` holds values that differ from the version group's catch rate. Yellow Dragonair 27 and Dragonite 9 are real capture values (pret pokeyellow base stats → `wEnemyMonActualCatchRate` → `ItemUseBall`), contrary to plan §3.5's earlier assumption. Kadabra 96 and partner Pikachu 163 stay note-only. Plan §3.5, §7.11 and §8 updated. |
| 2026-09-13 | `build.ts` is a thin command line over the pure `core/assemble.ts` (pages in, data + pokédex + issues out). Issues are `error` (nothing is written, exit code 1), `warning` or `note`. Fetching happens in two rounds: species lists and location pages, then species and learnset subpages. The live category check costs 1 request per build; offline builds use the category snapshot fixture. |
| 2026-09-13 | Output JSON is **compact**: `rby.json` is 244 KB against 792 KB pretty-printed (21 vs 32 KB gzipped). Plan §7.9 updated. `builtAt` changes on every build. |
| 2026-09-13 | Encounter-table types that differ from the species types (compared ignoring order) are **warnings**, not errors: species types come from the species list and type history, and table rows have typos (Cerulean Cave Rhyhorn/Rhydon "Rock/Ground", Vermilion City Tentacool without Poison). Plan §7.8 updated to match §7.4 step 8. An infobox that disagrees with the species list or the catch-rate list is an error. |
| 2026-09-13 | Golden assertions read the generated `public/data/*.json` files (not an offline build in the test), so `verify` checks exactly what the user commits. After pipeline changes, rerun `npm run data:build` before `verify`. |
| 2026-09-13 | Evolution-box diff: only the standard boxes are parsed (`Evobox-1/2/3`, `Evobox/1branch2`, `Evobox/2branch2`), from `Game data` → `Evolution data` (or `Evolution`). Stages with a `formK` value (regional forms) are skipped. Other layouts (Eevee's `Evobox/Setup` table, `Evobox/Meowth-Alola`) become notes, not a fallback parser: every Eevee edge is still checked through the Vaporeon/Jolteon/Flareon pages. An override edge missing from the boxes is a warning only if a fully readable page of either species was given. The earlier "31 pages have no Evobox" count was a detection mistake: all pages but Eevee have a standard box, some under `===[[Evolution]] data===` or `===Evolution===`. |
| 2026-09-13 | Catch-rate notes: `N prior to Generation X` and `N prior to <later-generation game>` apply automatically. `N in <games>` notes that only name games outside the version group are ignored. Everything else must be classified (with a `reason` and source), and classifications that match no note are errors too. |

## Session log

| Date | Summary |
|---|---|
| 2026-09-12 | Researched Bulbapedia (API, `catch/entry*` templates, walkthrough order, prizes/trades/statics formats, license). Wrote `IMPLEMENTATION_PLAN.md`. |
| 2026-09-13 | Revised the plan: multi-game architecture, deploy last, no license, no "seen" state, catch rate/stats/shiny/IV data and calculators. Created `CLAUDE.md` and `PROGRESS.md`. Removed git tasks (the user manages git manually). |
| 2026-09-13 | Phase 0: scaffolded Angular 22.1 (Material 22.1, TS 6.0, Vitest 4.1, angular-eslint 22.5) with nvm Node 26.8.2. Added the games registry and vocabularies, scripts tsconfig, theme generator, and a shell with routing, guard and placeholder pages. **Verification: `npm run verify` passes (lint clean, 14/14 tests, production build OK).** |
| 2026-09-13 | Phase 1 (part 1): MediaWiki client (batching, throttle, retries, redirects), page cache and fixtures, tokenizer, sections, markup, levels, rates, `entry1` + `entry2` adapters with a contract suite, encounter walker, merge, `rby` config with 57 ordered locations. Captured 12 fixtures (revids in the headers). **Verification: `npm run verify` passes (121 pipeline tests, 14 app tests). Smoke walk of all 57 live location pages: 0 errors, 0 warnings.** |
| 2026-09-13 | Phase 1 (part 2): cached 298 species and learnset pages (7 requests).<br>New modules:<ul><li>`core/generations.ts`</li><li>`core/species-list.ts`</li><li>`core/type-history.ts`</li><li>`core/species-pages.ts` (infobox extras, base stats by generation, Pokédex entries)</li><li>`core/learnsets.ts` (level-up per game, TM/HM, prior-evolution moves, move data, `collectMoves`)</li><li>`rby/overrides/evolutions.ts` (72 edges)</li></ul>Other changes:<ul><li>`models.ts`: `Move`, `Learnset`, `PokedexData` and species extras.</li><li>Markup renders `ScPkmn`, `ScBall`, `OBP`, `wp`.</li><li>10 new fixtures.</li><li>Plan §7.12 added.</li></ul>**Verification: `npm run verify` passes (168 pipeline tests, 14 app tests, build OK). Smoke run over all 151 species + learnset pages: 0 problems, 164 moves, 55 TMs/HMs.**<br>At the end of the session the user asked for a new feature: items per area with their prerequisites, recorded as plan §7.13 (research and design pending). |
| 2026-09-13 | Working rules only, no code changes: `CLAUDE.md` now requires asking before new dependencies or global installs, and forbids changing files outside the project (with exceptions). Dropped Playwright/e2e in favor of Vitest plus a manual smoke check (plan §13.9, §14, §16–18 updated). |
| 2026-09-13 | Fixed the stale Node PATH note. Phase 1 catch-rate history: `core/catch-rate-history.ts` (parses the `List of Pokémon by catch rate` table including form rows, sorts notes into earlier values / other games / needs classification, resolves per species with per-game overrides), `rby/overrides/catch-rate-notes.ts` (4 Yellow notes), new `catch-rate-list` fixture, `catchRateNotes` in the version-group config, `Species.catchRateByGame`. Checked the pret disassembly: Yellow Dragonair (27) and Dragonite (9) really use those values for capture, so the plan's note-only assumption was wrong (plan §3.5, §7.11, §8 updated). **Verification: `npm run verify` passes (182 pipeline tests, 14 app tests, build OK). With the rby classifications, all 151 species resolve with 0 errors (Raticate 90, note "127 from Generation III").** |
| 2026-09-13 | Phase 1 evolution-box diff: `core/evolution-boxes.ts` (generic stage/`evoK` key walk for standard boxes, regional-form stages skipped, condition text → level/trade/held item/friendship/stone, deduped across family pages, diff against the override as warnings plus notes). 5 new fixtures written from the cache: kadabra, slowpoke, dewgong, eevee, vaporeon. **Verification: `npm run verify` passes (192 pipeline tests, 14 app tests, build OK). Diff over all 151 cached species pages vs `RBY_EVOLUTIONS`: 0 warnings, 3 notes.** |
| 2026-09-13 | Phase 1 `build.ts` wiring: `core/assemble.ts` (species with Gen I catch rates, base stats, extras and types; Pokédex entries; learnsets and moves; evolution override plus box diff; location walk, merge and placement; category diff; sources) and `scripts/data/build.ts` (two-round fetch, report, compact output). New npm scripts: `data:build`, `data:build:all`, `data:refresh`, `data:offline`. Tests: `core/assemble.spec.ts` (placement, category diff) and `version-groups/rby/golden.spec.ts`. The first offline dry run failed on 7 table type mismatches, which became warnings (see Decisions). Two Vermilion City Tentacool rows turned out to be separate sub-areas (city and port), not a merge bug. **Verification: `npm run data:build` (1 request, the category) gives 0 errors, 9 warnings (8 pages without a Gen I section, Vermilion City Tentacool table types) and 3 notes. It wrote `public/data/rby.json` and `rby.pokedex.json`. `npm run verify` passes (211 pipeline tests, 14 app tests, build OK). Golden values match plan §7.8, §7.11 and §7.12.** |
