# Plans for the Coming Soon games

One plan per row of the game picker, in the order the rows appear (plan §13.3). Each row is one version group:
one data file, one pipeline config, one phase. Written 2026-10-13. They are **proposals**: each phase starts by
confirming its open decisions with the user, then the decisions move into `IMPLEMENTATION_PLAN.md` §16 and
`PROGRESS.md`, like Phase 10 did for Gold/Silver/Crystal.

Only the catch templates were checked against Bulbapedia. The lists of statics, gifts, events and exclusives in
each plan are **starting points from general game knowledge**. Each phase's research stage confirms them against
Bulbapedia and the pret disassemblies before any override is written.

| Phase | Row | Version group | Games (codec ids) | Plan |
|---|---|---|---|---|
| 12 | Ruby, Sapphire, Emerald | `rse` | ruby 7, sapphire 8, emerald 9 | [phase-12-rse.md](phase-12-rse.md) |
| 13 | FireRed, LeafGreen | `frlg` | firered 10, leafgreen 11 | [phase-13-frlg.md](phase-13-frlg.md) |
| 14 | Diamond, Pearl, Platinum | `dppt` | diamond 12, pearl 13, platinum 14 | [phase-14-dppt.md](phase-14-dppt.md) |
| 15 | HeartGold, SoulSilver | `hgss` | heartgold 15, soulsilver 16 | [phase-15-hgss.md](phase-15-hgss.md) |
| 16 | Black, White | `bw` | black 17, white 18 | [phase-16-bw.md](phase-16-bw.md) |
| 17 | Black 2, White 2 | `b2w2` | black2 19, white2 20 | [phase-17-b2w2.md](phase-17-b2w2.md) |

The phases build on each other: the first plan of a generation carries that generation's generic groundwork
(model fields, mechanics module, vocabularies), and the second row of the generation reuses it. Doing them out of
order means moving that groundwork with them.

## Rules every phase follows

- **Target: full parity** with Red/Blue/Yellow and Gold/Silver/Crystal (user choice, 2026-10-13): walkthrough-ordered
  guide, checklist with breeding, items with ticking, story checklist, learnsets and Pokédex entries, a `genN`
  mechanics module for the catch and IV tools, and the game's in-game sprites.
- **The games stay `planned` until the phase's acceptance passes.** They show as "Coming Soon" in production and
  open in dev builds (`PLANNED_GAMES_OPEN`). No release ships a work-in-progress game; flipping `status` to
  `available` is the last step and is what makes a release MINOR (plan §17.1).
- **No game branches in app code** (plan §19.1 step 10). Everything a game needs is data, a `GenerationFeatures`
  flag, a vocabulary entry or a mechanics module. If a phase finds a missing hook, it adds it generically in its
  Stage A.
- **Earlier groups stay identical.** Every Stage A ends with rby and gsc (and any later group already live) rebuilt
  byte-identical except `builtAt`, with `item-numbers.json` and `milestone-numbers.json` unchanged.
- **Contracts:** codec ids are already fixed in the registry. Item and milestone numbers start at 1 in each
  group's own `item-numbers.json` / `milestone-numbers.json`, written by the first build. Nothing here changes
  the `PKG*` formats: `dexCount` grows to 386, 493 or 649 and the bitfields follow it.
- **What counts as obtainable** (plan §1, §9): wild encounters, non-trade evolutions, in-game NPC trades, gifts,
  prizes, fossils, statics and breeding. **Excluded:** trading with another player; transfers from other games
  (Pal Park, Poké Transfer, the Unova Link); extra devices and companion games (Pokéwalker, Dream Radar,
  Pokémon Dream World, Colosseum/XD, Pokémon Ranger, the e-Reader); and distribution events, which are
  `event-only`. Species another game would supply get `requires-other-game` with the game named. Anything in
  between (dual-slot, Mirage Island, the Underground) is an open decision in the phase that meets it.
- **Being polite to Bulbapedia** (plan §7.3). Node's `fetch` gets HTTP 403 and so does WebFetch, but `curl` with
  the pipeline's `USER_AGENT` against `api.php` works (checked 2026-10-13). Each phase's research stage should
  first find out whether `mediawiki-client.ts` needs a transport change; everything is cached once fetched.
- **Every phase ends with** golden specs, `obtainability.golden.spec.ts`, a reviewed `reports/<group>.md`, a
  10-location seeded spot check, `npm run verify`, the user's browser check, a CHANGELOG line and a PROGRESS
  log entry.

## What the 2026-10-13 research found

A light check (three batched API requests plus the existing cache) settled each row's catch template. Details
are in each plan; in short:

| Template | Games | Positional parameters | Rates |
|---|---|---|---|
| `catch/entry3` | R, S, E | dex, name, R, S, E, method, levels, rate | one rate |
| `catch/entryfl` | FR, LG | dex, name, FR, LG, method, levels, rate | one rate |
| `catch/entry4` | D, P, Pt | dex, name, D, P, Pt, method, levels, morning, day, night | or `all=` |
| `catch/entryhs` | HG, SS | dex, name, HG, SS, method, levels, morning, day, night | or `all=`; `10=` is only the Headbutt tree icon |
| `catch/entry5` | B, W | dex, name, B, W, *unused*, method, levels, spring, summer, autumn, winter | or `all=`; `-` = not that season |
| `catch/entry5-2` | B2, W2 | dex, name, B2, W2, method, levels, spring, summer, autumn, winter | or `all=` |

Shared traps, on top of plan §3.3:
- The generation heading depth varies by region: Kanto pages use `===Generation III===`, Hoenn and Sinnoh pages
  `====Generation III====` under `===Pokémon===`, and Unova pages use **game headings** (`===Pokémon Black and
  White===`, `===Pokémon Black 2 and White 2===`) instead of a generation heading.
- From Gen IV on, rows carry `form=` and dex numbers carry form suffixes (`550B`, `585S`). One Unova row even
  computes its dex number with `{{#ifexpr: ({{#time: H}} mod 2)=0||F}}` (gendered Unfezant by hour).
- Several games' pages already sit in the cache: 723 `entryfl` rows and 2,110 `entryhs` rows from the Kanto and
  Johto pages fetched for rby and gsc.
