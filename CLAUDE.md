# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

- **`PROGRESS.md`** is the resume point. Read it first. It records the current phase, the next task, open questions and a session log. **Update it before ending any work session** (check off tasks, set "Next step", add a log entry).
- **`IMPLEMENTATION_PLAN.md`** is the authoritative design (about 1,200 lines). Don't read it top to bottom. Jump to the section you need (table of contents at the top; the phase checklists are in §16). If an implementation has to differ from the plan, update the plan and record the decision in `PROGRESS.md`.
- **`docs/plans/`** holds one plan per Coming Soon row of the game picker (Phases 12–17, in picker order). Start a game's phase from its plan and confirm its open decisions with the user first.

## What this is

**Poké Guide** is a companion web app for catching every Pokémon obtainable **without trading with another player**. It shows the Pokémon available in each area, in walkthrough order (levels, rates, types, catch rate), plus a checklist saved in `localStorage` with multiple named profiles and import/export codes. Red/Blue/Yellow ship first. The architecture must let Crystal, FireRed/LeafGreen, Emerald and later games be added **as data and config, not app changes**.

Stack: TypeScript, Angular 22, Angular Material 3, Vitest (no Playwright or other e2e suite; browser behavior is checked by hand, plan §14). Hosted on GitHub Pages.

## Angular style (hard rule)

**Always use the modern Angular 22 APIs.** This project has no legacy Angular code, and none may be added. When an older and a newer way exist, use the newer one; if you are unsure whether an API is current, check the installed typings under `node_modules/@angular/*/types/` rather than writing from memory.

Required:

- **Standalone components only.** No `NgModule`, no `CommonModule`/`BrowserModule`. Don't write `standalone: true` — it's the default and is redundant.
- **Signals for all state:** `signal`, `computed`, `linkedSignal`, `resource`/`httpResource`, `effect` (a last resort, for syncing to something outside Angular). No `BehaviorSubject` state.
- **`input()` / `output()` / `model()` / `viewChild()`**, never the `@Input`, `@Output`, `@ViewChild` decorators or `EventEmitter`.
- **`inject()`**, never constructor-parameter injection.
- **Built-in control flow** (`@if`, `@for` with `track`, `@switch`, `@let`, `@empty`), never `*ngIf`, `*ngFor`, `ngClass` or `ngStyle` (use `[class.x]` and `[style.x]`).
- **Signal Forms** (`@angular/forms/signals`: `form()`, `schema()`, the `FormField` directive as `[formField]`, validators like `required`/`maxLength`). **Never `FormsModule`/`ngModel` or `ReactiveFormsModule`.** Note `Field` is a *type*; the directive to import is `FormField`. Material's `mat-select` and friends aren't Signal Forms controls yet — bind those with a signal two-way binding (`[(value)]`) instead.
- **`ChangeDetectionStrategy.OnPush`** on every component; the app is **zoneless** (no `zone.js`).
- **Lazy routes** via `loadComponent`, and functional `CanActivateFn` guards and `redirectTo` functions, never class-based guards.
- **Minimal RxJS.** Prefer signals. Where an Angular API only gives an Observable (`MatDialogRef.afterClosed()`, `MatSnackBarRef.onAction()`, router events), consume it with `firstValueFrom` in an `async` method or convert it with `toSignal` — don't hand-manage `.subscribe()` calls.
- **Angular Material 3** attribute selectors: `matButton="filled"`, `matIconButton`, not the old `mat-raised-button`/`mat-icon-button` element selectors.

`src/app/core/{domain,games,mechanics}` stays framework-free (see below): no Angular imports there at all.

## Commands

Node 26.8.2 is managed with **nvm** (`.nvmrc`). Node is already on the PATH, including in Bash tool shells, so run `node`/`npm`/`npx` directly: don't run `source ~/.nvm/nvm.sh` or prefix commands with a PATH export.

```bash
npm start                       # ng serve (http://localhost:4200)
npm run verify                  # local quality gate: theme + fonts check + lint + scripts typecheck + unit tests + production build
npm test                        # Vitest via the Angular unit-test builder (watch mode in a TTY)
npm run test:ci                 # same, single run
npx ng test --watch=false --include src/app/core/games/registry.spec.ts --filter "codec"   # one file / tests matching a regex
npm run lint                    # angular-eslint over src/ and scripts/
npm run typecheck:scripts       # tsc -p tsconfig.scripts.json (scripts/ + framework-free core)
npm run format                  # prettier
npm run theme:games             # regenerate src/theme/*.generated.scss from registry seeds and type colors (--check in verify)
npm run fonts                   # re-download the self-hosted Roboto + icon-subset fonts into src/theme/fonts/ (--check in verify, offline)
npm run version:sync            # copy the package.json version to src/app/core/version.ts and ngsw-config.json (--check in verify)
npm version <major|minor|patch> # bump the version for a release (runs version:sync; never commits or tags, see .npmrc)
```

**Icons:** the Material Symbols font is a subset holding only the icons the app uses. After adding an icon, run `npm run fonts` (verify fails until you do). The scanner only sees literal `<mat-icon>name</mat-icon>` text (or quoted names inside its interpolation), `icon: 'name'` properties, and `icon('name')` calls from `src/app/shared/icon.ts`. Wrap any other icon name picked in code in `icon()`.

Data pipeline (plan §7.2). Each script covers every version group; add `-- --group gsc` for one:

```bash
npm run data:build              # scrape → parse → validate → write public/data/<group>.json (uses cache)
npm run data:refresh            # same, ignoring the cache
npm run data:offline            # build from fixtures/cache only (what tests use)
npm run data:sprites            # download the sprite sets
npm run data:fixtures           # capture parser-test fixtures into version-groups/<id>/__fixtures__
npm run data:validate           # check the committed data files and item registries (no network; CI runs it)
```

## Architecture (big picture)

### Two halves share one framework-free core
- **Build time (`scripts/data/`, run with `tsx`):** scrapes Bulbapedia wikitext through the MediaWiki API, parses it and applies curated overrides. It validates the result with zod and golden assertions, then writes **committed** JSON to `public/data/<versionGroup>.json` and sprites to `public/sprites/<setId>/`.
- **Runtime (`src/app/`):** loads that JSON lazily and computes everything else. **The app never calls Bulbapedia.**
- `src/app/core/games` (registry, method/condition vocabularies), `src/app/core/domain` (models, obtainability engine, export codec) and `src/app/core/mechanics` (per-generation rules) **must not import Angular**. The pipeline imports them through `tsconfig.scripts.json`.

### Game model (plan §4)
- **Generation** → **version group** (the unit of data files and pipeline config: `rby`, `gsc`, `frlg`, `rse`) → **game** (what a profile is tied to: `red`, `yellow`, `crystal`…).
- `core/games/registry.ts` is the single source of truth for games: `codecId`, `nationalDexMax`, regions, accent seed, sprite set, `available` vs `planned`.
- **Never add `if (game === 'yellow')` in app code.** Differences between games must be data, a `GenerationFeatures` flag, a vocabulary entry (encounter methods and conditions are registries), or a mechanics module.

### Data pipeline (plan §7)
- One Bulbapedia location page holds the encounter tables for **all** generations under `===Generation N===` headings, each in its own row template: `catch/entry1` (Red/Blue/Yellow), `catch/entry2` (Gold/Silver/Crystal, with morning/day/night rates), `catch/entryfl`, `catch/entryhs`…
  - Parsing is split into a generic core (brace-matching template tokenizer, heading tree, encounter walker, merge) and per-template **`CatchTemplateAdapter`s**.
  - Each version group has `scripts/data/version-groups/<id>/` with its config, per-game ordered locations, overrides, fixtures and golden tests.
- Some data isn't in encounter tables: static encounters and legendaries, starters, fossils, exclusive choices, unlocks and event-only species. These live in **curated override files** with source page and revid. Bulbapedia errors are fixed via `patches.ts` (each patch documented with a link), never by editing generated JSON.
- Parsing traps (details in plan §3.3):
  - Template-name casing varies.
  - Pokémon heading depth varies.
  - Floors can appear as the method column (Pokémon Tower, Mansion).
  - Several templates can share one line.
  - `{{tt|…}}` notes can appear inside rates.
  - `redirects=1` is required.
- Types come from the current National Dex list plus `type-history.ts`, which holds per-generation types (e.g. Gen I: Clefairy line is Normal, Magnemite is Electric).
- Catch rates come from species infoboxes plus the "List of Pokémon by catch rate" history. Unclassified notes there must **fail the build**. For example, Yellow "27" notes describe a held-item quirk, not a catch rate.
- Be polite to Bulbapedia: batched `titles=` (≤50), a random 2–5 s gap between requests, `maxlag=5`, a descriptive User-Agent, and the on-disk cache (`scripts/data/cache/`, gitignored). Bulbapedia content is CC BY-NC-SA 2.5, so the attribution in the app must stay.

### Obtainability (plan §9)
- `buildChecklist(data, game, features)` is a pure function:
  - Direct encounter sources, then a fixed-point closure over evolutions where `!requiresTrade`.
  - In-game trades only count if the species you give is obtainable.
  - Breeding counts where the generation has it.
- Exclusive groups (starter, fossil, Hitmon choice) stay obtainable but reduce the "max in one save" figure by the whole evolution family.
- Every species `1..nationalDexMax` must be obtainable or carry an `unobtainableReason`. The validator enforces this.

### App state (plan §11–12)
- Signal stores. `ProfileStore` holds profiles: `{id, name, game, caught: number[] (National Dex), itemsTaken: number[] (item numbers), milestonesDone: number[] (milestone numbers), progressPart?}`. `SettingsStore` holds global settings. Both persist to the single `localStorage` key `poke-guide/state`, with `schemaVersion` and migrations, debounced writes and cross-tab sync.
- The route `/:game/...` decides which data is shown. Catch toggles write only to the active profile **if its game matches**; otherwise a mismatch banner is shown.
- **The `PKG1-` export code is a compatibility contract:** binary → CRC-16 → base64url, holding the game `codecId` (uint16), `dexCount` and a caught bitfield keyed by National Dex. **Never reuse or change a `codecId`**, and never key saved state on array indexes. `PKG2-` (Phase 9) adds an items-taken bitfield and `PKG3-` (Phase 11) a milestones-done bitfield after it; the encoder writes the lowest format that holds the profile (`PKG1` with nothing ticked), and every format decodes forever.
- **Item numbers (`LocationItem.no`) are a contract too:** profiles and `PKG2` codes store them. The build assigns them through the committed, build-written registry `scripts/data/version-groups/<id>/item-numbers.json` (plan §7.13). Never edit it by hand or renumber: a vanished item fails the build until it is listed in `overrides/items.ts` → `retiredItems`, and numbers are never reused. Stage the registry with the data files.
- **Milestone numbers (`Milestone.no`, Phase 11) are the same kind of contract:** profiles and `PKG3` codes store them. The build assigns them by milestone id through the committed, build-written `scripts/data/version-groups/<id>/milestone-numbers.json`. Never edit it by hand, and never rename a milestone id in `overrides/milestones.ts`: retire its number in the file's retired list and add a new id.
- Items and story milestones never count as "caught" or towards any Pokémon progress figure.
- Catch status is **binary** (caught / not caught). There is intentionally no "seen" state.

### Mechanics (plan §4.5, §13.11)
Per-generation strategy modules (`core/mechanics/genN.ts`) provide the capture formula, stat formula, IV/DV system and shiny rules. They drive the generic catch-chance and IV/DV calculators. Implement formulas exactly as Bulbapedia's step-by-step algorithms describe, using integer math.

## Project constraints (decided with the user)

- **No license file** is added to the repo. The Bulbapedia attribution and the fan-project disclaimer in the About page are still required.
- **Git: stage, never commit (hard rule).** After each important step (a finished task or checklist item, a doc or rule change), run `git add` on the files that step changed, then end your message with a commit message for the user, in the format under "Commit messages" below. **Never run `git commit`** or any other git command that changes history, branches or remotes (`push`, `reset`, `checkout`, `stash`, `rebase`, `remote`…). The user commits, branches, pushes and creates the GitHub repo manually. Read-only commands (`git status`, `git diff`) are fine. Don't stage gitignored files (e.g. `scripts/data/cache/`) or changes unrelated to the step. Where the plan says data or sprites are "committed", generate the files and stage them. Tags are the user's too: whenever one is needed, give the manual steps from "Tag instructions" below.
- **Ask before installing anything outside the project.** Don't install global dependencies (`npm install -g`, global `npx` tool installs, `pip install --user`…) or additional programs (system packages, nvm Node versions, browsers, CLIs) without asking the user first.
- **Ask before adding any new dependency**, including project-local ones in `package.json` (`dependencies` or `devDependencies`), even if the plan already names the package. `npm install`/`npm ci` of dependencies already in `package.json` is fine.
- **Don't change files outside the project directory** (`/home/mih/Documents/Projects/poke-guide`). That includes dotfiles, shell profiles, global npm/git config and other projects. Allowed exceptions: Claude's memory folder (`~/.claude/projects/.../memory`), the session scratchpad under `/tmp/claude-*`, and tool caches such as `~/.npm`.
- **Deployment (Phase 8, plan §17):** GitHub Actions publishes to https://mihmin98.github.io/poke-guide/ (base href `/poke-guide/`) when a release tag `vX.Y.Z` is pushed; pushes to `master` only run CI (see "Versioning and releases"). Keep all asset and data URLs relative, since the app runs under a sub-path. The workflows live in `.github/workflows/` (`ci.yml`, `deploy.yml`, `data-refresh.yml`).
- The UI is English only. Sprites are the selected game's in-game sprites. Games are the international versions.

## Commit messages

Use Conventional Commits with the repo areas as scopes. Every commit has a headline **and** a body:

```
<type>(<scope>): <imperative summary>

<1–3 sentences: what the commit does and why. Mention the problem it
solves or the decision behind it, not a line-by-line diff.>

- <optional bullets for the separate pieces of a larger change>

<optional notes: compatibility, follow-ups, plan section refs>
```

- **Types:** `feat` (new capability, including new game data), `fix` (bug fix, or a Bulbapedia correction via `patches.ts`), `refactor`, `perf`, `test`, `docs` (PROGRESS.md, the plan, CLAUDE.md), `ci`, `chore` (dependencies, tooling, formatting; `chore(release): X.Y.Z` for a release), `data` (regenerated output only, e.g. `data(rby): refresh from Bulbapedia`).
- **Scopes:** `data/<group>` (`data/rby`, `data/gsc`…), `pipeline` (shared `scripts/data` code), `registry`, `domain`, `mechanics`, `codec`, app areas (`guide`, `checklist`, `profiles`, `settings`, `layout`, `theme`…), `progress`, `plan`, `deploy`, `ci`, `release`. Leave the scope out when a change spans many areas.
- **Headline:** lowercase after the colon, imperative, no trailing period, at most about 72 characters. Put the phase or stage tag in parentheses at the end where it helps: `feat(data/gsc): add the curated overrides (Phase 10 Stage C)`.
- **Body:** blank line after the headline, wrapped at 72 characters. Focus on the **why** and on what a later reader can't easily see in the diff (Bulbapedia quirks, rejected alternatives, compatibility guarantees). Use bullets only when the commit has separate parts. Put plan references (`See plan §9.2.`) at the end. Docs-only and trivial commits can have a one- or two-sentence body.
- **Contract changes** (`codecId`, the `PKG*` format, item numbers, saved-state schema) get a `!` after the scope and a compatibility note in the body:

```
feat(codec)!: add the PKG2 items-taken bitfield

Profiles can now track picked-up items, so export codes need to carry
them. PKG2 appends an items bitfield keyed by item number after the
caught bitfield.

- Encoder writes PKG1 when no items are ticked, PKG2 otherwise
- Decoder accepts both formats

Compatibility: every existing PKG1 code still decodes unchanged.
codecIds are untouched.
```

## Versioning and releases (plan §17.1)

The app version (`package.json`, currently 1.0.0) follows SemVer **from the user's side**. What users hold is their saved state, `PKG*` codes, backup files and `/:game/...` links.

- **MAJOR:** something a user holds stops working: a state that can't be migrated, a code or backup that no longer imports, a deep link that breaks without a redirect. The contracts above exist to prevent this. If a change would need a MAJOR bump, stop and ask the user first.
- **MINOR:** a new capability that keeps everything working: a game becoming `available`, a new page or tool, a new `PKGn` format added on top, a state schema migration.
- **PATCH:** bug fixes, `patches.ts` and override corrections, a merged data-refresh PR, UI polish, dependency bumps.
- **No bump:** docs, CI, reports, tests and refactors nobody can see.

Rules:
- **A commit `!` doesn't mean MAJOR.** It marks any contract change, including compatible ones like `feat(codec)!` for PKG3. Pick the bump from the list above, never from commit types. Don't add release-please, changesets or similar tools.
- **The app version is separate from the internal versions:** the state `schemaVersion`, the data file `schemaVersion`, the `PKG*` formats, `codecId`s and item and milestone numbers. Never bump or reset one to match another.
- **Never edit the version by hand.** `src/app/core/version.ts` and `ngsw-config.json` → `appData` are generated from `package.json`. Change the version only with `npm version`, and only when the user asks for a release.
- **Keep `CHANGELOG.md` current.** When you stage a change users can notice, add a line under `## [Unreleased]`. Use the *Added*, *Changed*, *Fixed*, *Data* and *Compatibility* subsections, written for users, not as commit headlines. If a contract changed, the *Compatibility* line says what still reads.

**Release workflow** (when the user asks for a release):
1. Read `## [Unreleased]` and `git log v<last>..HEAD`, and propose the bump with a one-line reason.
2. Run `npm version <major|minor|patch>`. It updates `package.json`, `package-lock.json`, `src/app/core/version.ts` and `ngsw-config.json`, and never commits or tags.
3. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - <date>` and add a new empty `## [Unreleased]` above it. Update the `[Unreleased]` compare link at the bottom and add an `[X.Y.Z]:` link.
4. Run `npm run verify` and stage those five files. End the message with the commit message (`chore(release): X.Y.Z`, with the changelog highlights in the body), followed by the tag instructions below.
5. Pushing the tag deploys. `deploy.yml` fails unless the tag is `v` + the `package.json` version, and a manual run must be started from the tag. Add a log entry to `PROGRESS.md`.

**Tag instructions (hard rule).** You never create, move, delete or push tags; the user does it by hand. So whenever a tag is needed, give the user the exact steps, with the real version filled in:
- at the end of every message that stages a version bump, after the commit message
- whenever `package.json` holds a version with no tag yet (`git tag -l vX.Y.Z` prints nothing) and the user commits, pushes, or asks about deploying or going live

Use this block:

````
After committing the staged changes, release X.Y.Z by hand:

```bash
git tag -a vX.Y.Z -m "Poké Guide X.Y.Z"   # on the release commit
git push origin master                     # CI runs; nothing deploys yet
git push origin vX.Y.Z                     # Deploy publishes X.Y.Z
```

Then check the "Deploy" run for vX.Y.Z on the Actions tab. If you tagged the
wrong commit and haven't pushed the tag yet: `git tag -d vX.Y.Z`, then tag again.
````

Never tell the user to move or delete a tag that has already been pushed. A released version is fixed: ship the fix as the next PATCH instead.
