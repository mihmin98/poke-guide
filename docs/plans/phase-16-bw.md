# Phase 16 — Gen V: Black, White

| | |
|---|---|
| Version group | `bw` (data file `data/bw.json`, mechanics `gen5`) |
| Games | Black (codec 17, 2011), White (18, 2011) |
| Region | Unova; regional dex "Unova Pokédex" |
| National Dex | 1–649 |
| Depends on | Phase 14 (Gen IV groundwork: move categories, forms, `requiresSpecies`). Carries the **Gen V groundwork** that Phase 17 (Black 2/White 2) reuses. |
| Shared rules | [README](README.md) |

The first Gen V row. The new parts:

- seasons as rate columns
- the phenomena methods (shaking grass, dust clouds, flying shadows, rippling water)
- game headings instead of generation headings
- animated sprites
- critical captures in the `gen5` capture formula

## Proposed decisions (confirm at the start)

- **One `bw` group**, one walkthrough. All-new Unova location ids, which Phase 17 reuses.
- **Seasons as columns:** the `season` condition switches from `display: 'chip'` to `'column'`, like time of day,
  so encounter tables get Spring / Summer / Autumn / Winter columns that collapse when all four are equal. This is
  generic, and no live game uses seasons yet.
- **Seasonal access:** some areas and items change with the season. Proposal: a `season` condition on items and a
  location note, not a separate location.
- **Count as obtainable:**
  - Dark grass, shaking grass, dust clouds, flying shadows, rippling water.
  - Swarms (confirm that they need no online feature).
  - The Larvesta egg, the elemental monkey gift.
  - The fossils, the version legendary.
  - Kyurem, the Swords of Justice, Volcarona.
  - Tornadus/Thundurus (version roamers).
  - Landorus, via `requiresSpecies` (needs both roamers, so `other-version`).
- **Linked exclusive group:** the monkey gift depends on the starter choice (Phase 13's linked groups).
- **Event-only:** Victini (Liberty Pass), Keldeo, Meloetta, Genesect, Zorua/Zoroark (they need event Celebi or the
  event beasts), plus earlier mythicals.
- **Excluded:** Pokémon Dream World (Hidden Abilities, Entree Forest), Poké Transfer, Global Link.
- **Forms:** Deerling/Sawsbuck seasons, Basculin stripes, Darmanitan, Unfezant/Frillish/Jellicent genders. All are
  form labels; the checklist stays per species.
- **Scope: full parity** (README).

## What the research found (2026-10-13)

- Unova pages (Unova Route 1 revid 4613220, Route 6 revid 4592817) have **no generation heading**. They use
  `===Pokémon Black and White===` and `===Pokémon Black 2 and White 2===` under `==Pokémon==`. The walker
  needs a config option to pick a section by **game heading**.
- `catch/entry5` (Template revid 4027974):
  - `dex|name|B|W|<unused>|method|levels|spring|summer|autumn|winter`, or `all=`; `-` means not in that season.
  - The fifth positional is a leftover third flag the template ignores. **Don't read it as a game.**
- The method switch lists:
  - Grass, Dark (dark grass), Rustling (shaking grass), Dust, Shadow, Rippling (rippling water).
  - Surf, Cave, Sand, Building, Puddle, Tall grass, Dark tall grass.
  - Fish Old/Good/Super/Fishing.
  - Gift, Starter, Swarm, Egg, the fossils (including Cover and Plume), Trade, Special, Liberty (the event
    ticket).
- On Route 1, the Swarm div's rows use method `Grass`, so the condition comes from the div, as in gsc.
- Rows carry `form=` and suffixed dex numbers (`550B`, `585S`/`A`/`W`).
- Route 6's Unfezant row computes its dex number with `{{#ifexpr: ({{#time: H}} mod 2)=0||F}}`. The adapter
  must resolve that to the species and drop the gender form.

## Stage A — Gen V groundwork

Earlier groups rebuilt byte-identical except `builtAt`.

- [ ] **Walker:**
  - Section selection by game heading (`sectionHeadings: ['Pokémon Black and White']` beside
    `generationHeading`).
- [ ] **Vocabularies:**
  - Methods `walk-dark-grass`, `shaking-grass`, `dust-cloud`, `flying-shadow`, `rippling-water` (surf and fishing
    variants as sub-methods or two ids; decide by how the UI groups sections).
  - `season` becomes a column kind.
- [ ] **Model:**
  - `season` conditions on items.
  - Gen V evolution kinds: Karrablast/Shelmet trade with each other (`requiresTrade`), and any others the Stage C
    graph finds.
- [ ] **Pipeline:**
  - The `entry5` adapter.
  - Animated-sprite still frames (Gen V sprites are animated; reuse `stillFrame` or extend it).
  - The Gen V learnset and Dex columns.
- [ ] **App UI:**
  - Season columns on location rows.
  - Critical-capture inputs in the catch tool (see Stage G).

## Stage B — `version-groups/bw/` config, locations and walkthroughs

- [ ] Research first: the category, the walkthrough, about 10 Unova pages, `In-game trade`, the Unova dex list,
  the season and phenomena pages.
- [ ] Config, locations, walkthrough placement.
- [ ] Fixtures, snapshot, registration.

## Stage C — curated overrides

Each override records its source page and revid.

- [ ] **`encounters.ts`:**
  - **Statics:** Reshiram/Zekrom, Kyurem, Cobalion, Terrakion, Virizion, Volcarona, the Musharna (Dreamyard)
    if it's catchable, the Darmanitan statues.
  - **Roamers:** Tornadus/Thundurus.
  - **Gifts:** starters, the monkeys, Larvesta egg, the Zorua question, fossils (Cover/Plume as an exclusive group,
    if confirmed).
  - Event-only and `requiresOtherGame` (pre-Unova species with no post-game source).
- [ ] **`evolutions.ts`:** Gen V kinds and `requiresTrade` edges.
- [ ] **Breeding:** the Route 3 Day Care.
- [ ] **Unlocks:**
  - HMs (Cut, Fly, Surf, Strength, Waterfall, Dive).
  - The post-game National Dex areas, the Liberty Pass (event).
  - Seasonal gates.

## Stage D — species and Pokédex data

- [ ] 649 species: Gen V base data, abilities (no hidden ones), Dex entries per game, learnsets, moves.

## Stage E — items

- [ ] Cross-check, overrides, hidden items (Dowsing MCHN).
- [ ] Season-only items.
- [ ] Recurring sources as notes: berries, the daily gifts, shaking-grass and dust-cloud items.
- [ ] The first build writes `bw/item-numbers.json`.

## Stage F — sprites

- [ ] Black/White front sprites (animated originals, first frame kept) into `gen5-bw/`. Check the archive names
  and formats.

## Stage G — `core/mechanics/gen5.ts`

- [ ] The Gen V capture formula with **critical captures**. Their chance depends on how many species are caught,
  which is a `CaptureInputDef` number the catch tool could prefill from the profile.
- [ ] The dark-grass modifier; the Dream Ball is excluded (Dream World).
- [ ] Stats as Gen III–IV; Shiny 1/8192; characteristics.
- [ ] Tests from Bulbapedia's worked examples.

## Stage H — story checklist

- [ ] Milestones: gyms, Team Plasma, N's castle, the Elite Four, the post-game (Ghetsis rematches, the Swords of
  Justice).
- [ ] Numbers file, flag, goldens.
- [ ] Journey anchors (plan §7.14, §13.13): review the report's Journey section and give each revisit milestone an
  `after` anchor where its default position is wrong.

## Stage I — validation, goldens, report, go live

- [ ] Goldens:
  - Each game's counts.
  - Season columns and Deerling's seasonal forms collapsing into one species.
  - Phenomena methods.
  - The Landorus `requiresSpecies`.
  - The linked monkey group.
- [ ] Report, spot check, flip to `available`.

## Open research questions

1. Do Black/White swarms need anything online, or do they start on their own each day after the Hall of Fame?
2. Exactly which fossils each version gets, and whether the choice is exclusive.
3. Which pre-Unova species are wild in the post-game, per version. That decides `requiresOtherGame`'s size.
4. Animated sprite format on the archives (APNG or GIF) and how `stillFrame` handles it.
5. Should the catch tool prefill the critical-capture species count from the active profile's caught count?

## Accept when

- 0 errors, triaged warnings, earlier groups unchanged.
- Every species 1–649 is obtainable or has a reason in each game.
- Season columns render correctly at 360 px and 1440 px.
- The spot check matches.
- The Gen V tools match hand-worked examples.
- The user's browser check passes.
