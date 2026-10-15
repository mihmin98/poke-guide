# Phase 19 — Story battles: trainer teams and encounter levels

| | |
|---|---|
| Kind | Feature (not a game); applies to every version group with a story checklist |
| Version groups | `rby`, `gsc` now; later groups follow through their Stage H (plan §19.1) |
| Depends on | Phase 11 (story milestones), Phase 18 (Story and Guide journey) |
| Contracts | None changed: no new numbers, no saved-state or `PKG` change; the data `schemaVersion` stays 1 |
| Written | 2026-10-15; decisions confirmed with the user the same day |

Numbered after the game phases 12–17 (and Phase 18) but meant to be built before Phase 12, like Phase 18.

## Context

Story milestones say *what* happens ("Defeat Brock", "Rival battle 3") but not what you face. The user wants each
story battle to show the trainer's team (Pokémon, levels, moves), so a battle can be prepared for from the Story and
Guide tabs.

The data is already on disk: the cached Bulbapedia walkthrough part pages that the build reads for the item and
milestone cross-checks (94 pages, **no new requests**) hold 175 `{{Party}}` blocks with 685 `{{Pokémon}}`
members, all in one consistent template form.

## Decisions (user choices, 2026-10-15)

1. **Detail:** Pokémon, levels and moves, plus the prize money.
2. **Rival variants:** a tab per variant, preselecting the starter you've marked caught when exactly one of them is.
3. **Statics and gifts:** static-encounter and gift milestones (Snorlax, Articuno, Lapras, Eevee…) also show their
   level, from the encounter data the app already has.
4. **Placement:** a collapsible "Team" panel on the Story page and the location page's Story section; the Guide's
   compact story rows show only the level range ("Lv 12–14").

## What the research found (2026-10-15)

Measured over all 94 cached walkthrough pages (Red/Blue, Yellow, Gold/Silver, Crystal) and the committed data.

- **Party block shape:** `{{Party | name | class | sprite | prize | location | caption | pokemon=N }}`, then N ×
  `{{Pokémon | ndex | pokemon | level | gender | type1/2 | move1..4 (+ moveNtype) }}`, then `{{Party/end}}`.
  - Every member has `gen`, `ndex`, `pokemon`, `type1`, `level` and `move1`; 678 have `move2`, 647 `move3`, 585
    `move4`.
  - No held items, even in Gold/Silver/Crystal.
  - `gender` is `male` (304), `female` (50) or `both` (4; treated as unknown).
  - `name` is wrapped in `{{color2|000|…}}`, sometimes with a link target (`{{color2|000|Blue (game)|Blue}}`).
    `prize` is `{{PDollar}}1,386`. `class` (65 parties) is the trainer class ("Leader", "Elite Four", "Rocket").
  - The `game` parameter is `RB`, `Y`, `GS` or `C` (one page says `Yellow`). The parser ignores it: the page itself
    tells which games it covers (the config's `walkthroughPages`).
  - Gym parties sit inside a `{{WalkthroughGym}}` box's `party =` parameter, so they're found by their opening, as
    `countPartyBattles` (`core/milestones.ts`) already does.
- **Variants:** `caption` is `{{PlayerChoice|0001|Bulbasaur}}` (the starter the player chose; 60 parties) or, in
  Yellow, `{{BlueEevee|Vaporeon}}`, sometimes with `evolved=no` (how the rival's Eevee evolves; 12 parties). Variants
  come as consecutive runs of parties with the same name and location.
- **Matching parties to milestones**, checked in all 6 games:
  - Each part page's parties come in the same order as that part's `gym`/`battle` milestones.
  - Names repeat inside a part: "Executive" twice in Gold/Silver/Crystal Part 11 (Rocket HQ), and four times in
    Part 12 (Radio Tower, with the rival in between). Matching in page order resolves them.
  - The rival is "???" before you name him (Gold/Silver/Crystal Part 2), then "Silver". Jessie and James are
    "Rocket" (Yellow). The Karate Master is "Blackbelt", the Karate King "Kiyo".
  - A few battle milestones have **no party block**: the Route 25 Jr. Trainer (Red/Blue/Yellow Part 5), the Nugget
    Bridge Rocket (Gold/Silver/Crystal Part 19) and the Wise Trio (Crystal Part 12). They simply get no team.
- **Moves:** the page's move names match each group's Pokédex move list (`public/data/<group>.pokedex.json`,
  `moves[].name`) exactly. Checked against the whole cache, the 57 names missing from the Red/Blue/Yellow list are
  all Gen II moves from Gen II pages. So each move is checked against its own group's list, and its type comes from
  our data (`moves[].type`), not from the page.
- **Size:** about 300 members per group. Red/Blue and Gold/Silver share their pages, so their teams are stored twice
  (once per game). That's roughly +50–70 KB raw per main data file, much less gzipped. That's acceptable in the main
  file, which the Story page loads anyway. (Measured in Stage B: +82 KB raw / +4.8 KB gzipped for rby, +122 KB /
  +5.9 KB for gsc.)

## Design

### 1. Data model (`src/app/core/domain/models.ts`)

```ts
interface TeamMember {
  dex: number;
  level: number;
  gender?: 'male' | 'female';
  moves: { name: string; type: PokemonType }[];
}
type TeamVariant =
  | { kind: 'starter'; dex: number }                         // "If you chose Bulbasaur"
  | { kind: 'rival-eevee'; dex: number; evolved: boolean };  // Yellow: "If his Eevee becomes Vaporeon"
interface TrainerTeam {
  trainer: string;          // "Brock", "Blue", "Executive"
  trainerClass?: string;    // "Leader", "Elite Four"
  prize?: number;           // 1386
  variant?: TeamVariant;
  pokemon: TeamMember[];
}
// on Milestone:
teams?: Partial<Record<GameId, TrainerTeam[]>>;  // one team, or one per variant
```

- The curated input gets `trainer?: string | readonly string[]`: the party `name` to match, with alternatives
  such as `['???', 'Silver']`.
- `MilestoneDefinition` (`scripts/data/core/milestone-numbers.ts`) becomes
  `Omit<Milestone, 'no' | 'teams'> & { trainer?: string | readonly string[] }`. The output keeps `teams` and drops
  `trainer`.
- The field is optional and additive, so the data `schemaVersion` stays 1. Milestone numbers, item numbers, saved
  state and `PKG` codes are untouched.

### 2. Pipeline

- **New `scripts/data/core/parties.ts`:**
  - `parseParties(wikitext)` returns the parties in page order, each with its name, class, prize, variant and
    members. It reuses `findTemplates` / `parseTemplate` (`core/wikitext.ts`) and `stripMarkup` (`core/markup.ts`),
    plus the opening regex from `countPartyBattles`. A party ends at `{{Party/end}}`.
  - `attachTeams(milestones, walkthroughPages, movesByName)`, per game and part page: a milestone with `trainer`
    claims the **first unclaimed battle** whose party name matches, in page order. A battle is one party, or a run
    of consecutive parties with the same name and location that each have a variant caption: the variants.
    (Corrected in Stage B: without the caption condition, the Radio Tower's three consecutive Executives would
    merge into one battle.)
  - **Errors:**
    - a `trainer` with no unclaimed match on its part page in one of its games;
    - `trainer` on a milestone whose kind isn't `gym` or `battle`;
    - a move name not in the group's move list.
  - **Warnings:**
    - a party no milestone claims. This replaces the count heuristic in `checkMilestonesAgainstWalkthrough`.
    - page types that differ from our species types for that generation.
- **Overrides:** set `trainer` through the existing helpers and per entry, in
  `version-groups/{rby,gsc}/overrides/milestones.ts`.
  - **Red/Blue/Yellow:**
    - `gym(leader, …)` passes the leader;
    - `rival()` uses `'Blue'`, and the Champion is `'Blue'` too;
    - Jessie & James use `'Rocket'`;
    - the Karate Master is `'Blackbelt'`;
    - Giovanni and the Elite Four go by name.
  - **Gold/Silver/Crystal:**
    - the rival is `['???', 'Silver']`;
    - the Executives are `'Executive'`;
    - the others go by name: Li, Grunt, Eusine, Cal, Red, Kiyo, and Lance as Champion.
- **Assembly** (`core/assemble.ts`, next to the milestone cross-check): attach the teams using the Pokédex moves
  the same build produces.
- **Validation** (`core/validate.ts`, so `data:validate` checks the committed files too):
  - a zod schema for `teams`;
  - `dex` and variant `dex` within the species list;
  - level 1–100;
  - every move name in the group's `pokedex.moves`, with the same type.
- **Report:** a "Story battles" table per game in `reports/<id>.md` with the battle milestones, how many have a
  team, and the unclaimed parties.
- **Goldens:**
  - Red, Brock: Geodude Lv 12 (Tackle, Defense Curl), Onix Lv 14.
  - Red, Rival battle 1: three variants with starters 1, 4 and 7.
  - Yellow, Rival battle 1: one team (Eevee). Jessie & James have teams.
  - Crystal, Falkner.
  - Gold, Red at Mt. Silver: Pikachu Lv 81.
  - The Champion is Lance in Gold/Silver/Crystal and the rival in Red/Blue/Yellow.
- **Rebuild with `npm run data:build`** (cache-first, no requests). Don't use `data:offline`: it reads the parser
  fixtures first, and some are older than the cache, as found in Phase 18 with Rattata. Stage `rby.json`, `gsc.json`
  and the reports. `*-numbers.json` must not change.

### 3. App

- **Levels** (pure; in `core/domain/milestone-progress.ts` or a new `core/domain/milestone-levels.ts`):
  - `teamLevels(team)`: the min–max level of a team.
  - `encounterLevels(milestone, view, game)`: the levels of the milestone's `dex` encounter at its location
    (statics and gifts), from `encountersFor` (`core/domain/game-view.ts`).
  - Displayed with `shared/components/level-range.ts`.
- **New `shared/components/milestone-team.ts`:**
  - Variant tabs (`role="tablist"`): "If you chose Bulbasaur", or "If his Eevee becomes Vaporeon" (Yellow).
    (As built: a "You chose" / "His Eevee becomes" prompt with short tabs named after the species, the full
    phrase as each tab's accessible name, so three tabs fit at 360 px.)
  - The preselected tab is the starter variant whose `dex` is in the active profile's caught set, when exactly one
    variant matches and the profile is for this game. Otherwise the first tab.
  - A trainer line: "Leader Brock · ₽1,386".
  - Per member:
    - `Sprite` and the name, linking to the Pokémon page;
    - `TypeBadge` types from our species data;
    - "Lv 14" and a ♂/♀ symbol;
    - move chips tinted by move type (the existing type colours).
- **`MilestoneRow`** (`shared/components/milestone-row.ts`):
  - **Full rows** (Story page, the location page's Story section): a "Team · Lv 12–14" disclosure button when
    the milestone has teams in this game. It expands the `MilestoneTeam` panel and is collapsed by default. Static
    encounters and gifts get a plain "Lv 30" tag.
  - **Compact rows** (Guide): only the level-range tag, no panel.
  - Encounter levels come in as an input, computed by the callers: `features/story/story-model.ts`,
    `features/guide/guide-model.ts` and the location page.
- **Icons:** none expected (gender as ♂/♀ text, an expand arrow that already exists). If one is added, run
  `npm run fonts`.

### 4. Docs

- `IMPLEMENTATION_PLAN.md`:
  - §7.14: teams, the `trainer` matching and its checks;
  - §8: the model;
  - §13.12: the team panel;
  - §16 Phase 19: tick the stages;
  - §19.1: set `trainer` when writing a group's milestones.
- A checklist line in each game plan's milestone stage (`docs/plans/phase-1[2-7]-*.md`).
- `PROGRESS.md`; `CHANGELOG.md` *Added*: a MINOR feature when released.

## Stages (stage the files after each one, give a commit message, never commit)

- [x] **A.** Docs: §7.14, §8, §13.12, §19.1 and the game plans' checklist line (this plan and the §16 entry
  already exist).
- [x] **B.** Pipeline (2026-10-15):
  - the model;
  - `parties.ts` with its spec (fixtures cut from the cached pages);
  - `attachTeams`;
  - the `trainer` curation for rby and gsc;
  - validation, the report table and the goldens;
  - rebuilt data.
- [x] **C.** App (2026-10-15):
  - the levels helpers;
  - `MilestoneTeam`;
  - the `MilestoneRow` disclosure and level tag;
  - the callers (Story, Guide, location page);
  - specs and the changelog.
- [ ] Manual browser check (the user).

## Verification

- **Pipeline specs:** `npx vitest run --config vitest.scripts.config.ts scripts/data/core/parties.spec.ts`. It
  covers:
  - Brock's box inside `{{WalkthroughGym}}`;
  - a three-way rival run;
  - Yellow `BlueEevee` captions with `evolved=no`;
  - the Gen II `gender` values;
  - same-named Executives matched in page order;
  - the unclaimed-party warning;
  - the unknown-move error.
- **Data build:** `npm run data:build` gives 0 errors and no unexplained unclaimed-party warnings. Item and milestone
  numbers are unchanged (empty `git diff` on `*-numbers.json`). The goldens pass; `npm run data:validate` is OK.
- **App specs:**
  - `milestone-team`: variant tabs, the starter guess, moves;
  - `milestone-row`: the disclosure and the compact level tag;
  - `story-model` and `guide-model`: encounter levels.
- `npm run verify`.
- **Manual** (`npm start`, 360 px and 1440 px, light and dark):
  - `/red/story`: Brock's Team panel; Rival battle 1's tabs preselect your starter.
  - `/yellow/story`: the rival's Eevee tabs; Jessie & James.
  - `/crystal/story`: Falkner, the Radio Tower Executives, Red.
  - Snorlax and Articuno show "Lv 30" and "Lv 50".
  - `/red/guide`: compact rows show "Lv 12–14".
  - `/red/guide/pewter-city`: the Story section has the panel.

## Accept when

- Every battle milestone with a party block shows its team (with variants) in each of its games.
- Statics and gifts show their level.
- No party on a walkthrough page is left unclaimed without a reason.
- Existing profiles, codes and links are unaffected.

## Out of scope (possible later)

- **Trainer sprites:** the `sprite` parameter names Bulbagarden Archives files, but downloading them would be a new
  sprite set.
- **Ordinary trainers:** the `{{Trainerentry}}` lists of gym trainers and route trainers, which would also give
  teams to the Route 25 Jr. Trainer and the Nugget Bridge Rocket.
- **Held items:** Gen II trainers hold items, but the walkthrough pages don't list them.
