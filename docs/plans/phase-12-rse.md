# Phase 12 — Gen III: Ruby, Sapphire, Emerald

| | |
|---|---|
| Version group | `rse` (data file `data/rse.json`, mechanics `gen3`) |
| Games | Ruby (codec 7, 2003), Sapphire (8, 2003), Emerald (9, 2005) |
| Region | Hoenn; regional dex "Hoenn Pokédex" |
| National Dex | 1–386 |
| Depends on | Phases 1–11 (all live). Carries the **Gen III groundwork** that Phase 13 (FireRed/LeafGreen) reuses. |
| Shared rules | [README](README.md) |

The first game of a new generation, so it carries the most generic work: abilities, natures, 0–31 IVs with
EVs, a personality value, the `gen3` mechanics module and the Gen III evolution kinds. Everything after Stage A
follows the Phase 10 pattern.

## Proposed decisions (confirm at the start)

- **One `rse` group**, with Emerald placed from its own walkthrough, like Crystal in `gsc`. Ruby and Sapphire share
  a walkthrough.
- **Scope: full parity** (README).
- **Count as obtainable:** the Safari Zone (with Emerald's extra areas after the Hall of Fame), Feebas on its
  Route 119 tiles, roaming Latias/Latios, the Regis (the Braille puzzles only need Wailord and Relicanth, both
  obtainable), the Wynaut egg, Castform, Beldum and the fossils.
- **Event-only:** Mew (Faraway Island), Lugia and Ho-Oh (Navel Rock), Deoxys (Birth Island), Jirachi, and
  Southern Island's Latias/Latios (Eon Ticket). The roaming Latias/Latios aren't event-only.
- **Open: Mirage Island.** Its Wynaut appear only on days when a random value matches a party Pokémon's
  personality value. Proposal: count it, and add a "rare, random" location note.
- **Open: Shoal Cave tides.** Encounters and items change between high and low tide. Proposal: model them as
  sub-areas, not a new condition kind.
- **Open: abilities.** `GenerationFeatures.abilities` is reserved. Proposal: show the one or two abilities on the
  Pokémon page from now on, without hidden abilities (Gen III has none).
- **Forms** (Unown's 28 letters, Castform, Deoxys) are notes. The checklist stays per species.
- **Excluded item sources:** Battle Tower and Battle Frontier point prizes are left out, like Crystal's Battle
  Tower. Berry trees become location notes, like Gen II fruit trees.

## What the research found (2026-10-13)

- `catch/entry3` (Template revid 4027971): `dex|name|R|S|E|method|levels|rate`, plus `type1`/`type2`. Hoenn Route
  101 (revid 4642897) uses `====Generation III====` under `===Pokémon===`, one level deeper than the Kanto pages.
- The template's method switch lists: `Grass`, `Long grass`, `Surf`, `Dive`, `Sand`, `Building`, `Cave`,
  `Fish Old/Good/Super`, `Rock Smash`, `Prize`, `Fake`, `Gift`, `Starter`, `Swarm`, `Egg`, `Root`, `Claw`,
  the event tickets (`Eon`, `Mystic`, `Aurora`, `Map`), `Trade` (`tradenum`/`tradename`) and `Special`. Anything
  else is a floor label, as in rby.
- Starters are `Gift` rows under a `First partner Pokémon` div with the rate `One`.

## Stage A — Gen III groundwork

rby and gsc rebuilt byte-identical except `builtAt`, with their number registries unchanged.

- [ ] **Registry and vocabularies:**
  - Confirm `GEN3_FEATURES`.
  - Methods for `Dive`, `Long grass`, `Sand` and the event tickets. Each one is mapped to a method or dropped
    as event-only, depending on what the Stage B pages actually use.
  - `Swarm` becomes the existing `swarm` condition, as in gsc.
- [ ] **Model (§8) and zod schema:**
  - `Species.abilities` (Gen III+, optional).
  - Evolution kinds:
    - `beauty` (Feebas → Milotic; no trade, so it counts)
    - the Nincada split (Ninjask plus a Shedinja for a free party slot and a Poké Ball)
    - Wurmple's personality-based split (random: both count, nothing exclusive)
  - Incense breeding: Azurill (Sea Incense) and Wynaut (Lax Incense) in `BreedingRules`.
- [ ] **Mechanics interface (§4.5):**
  - The `iv` system with EVs and **natures** (the stat formula changes).
  - A nature input for the IV tool.
  - Hidden Power type and power from IVs.
  - The personality-value rules (Shiny from PID/TID/SID, gender from PID, Unown letter, Wurmple), written as
    data hooks like Gen II's `DvTraitDef`.
- [ ] **Pipeline:**
  - The `entry3` adapter.
  - Generation headings at any depth.
  - Gen III learnset columns: R/S vs E level-up, TM/HM, Emerald's tutors, egg moves.
  - The Gen III Pokédex-entry columns.
  - The catch-rate history (unchanged rules; new notes must still fail the build until classified).
  - Abilities from the infobox.
- [ ] **App UI:**
  - The abilities line on the Pokémon page (if decided).
  - The nature selector and Hidden Power result in the IV tool.
  - Hoenn Dex sort through `regionalDex` (generic already).

## Stage B — `version-groups/rse/` config, locations and walkthroughs

- [ ] Research first (cache-first): `Category:Ruby, Sapphire and Emerald locations` (check the real name), both
  walkthroughs, about 10 Hoenn pages, `In-game trade`, the Mauville Game Corner and the Hoenn dex list.
- [ ] `config.ts`, `locations.ts` (all new Hoenn ids) and `walkthrough.ts`, with placement per game. Emerald moves
  some gyms and story beats (the Magma/Aqua order, the Battle Frontier), so it gets its own placement as
  Crystal did.
- [ ] Fixtures, the category snapshot, registration in `version-groups/index.ts`.

## Stage C — curated overrides

Each override records its source page and revid, plus a pret `pokeruby`/`pokeemerald` reference.

- [ ] **`encounters.ts`:**
  - **Statics:** Kecleon (Devon Scope), Voltorb, Electrode, Sudowoodo (Emerald), Groudon or Kyogre, Rayquaza,
    the Regis.
  - **Emerald's post-game legendaries:** Groudon/Kyogre in Terra Cave and Marine Cave.
  - **Roamers:** Latias/Latios.
  - **Gifts:** starters, the Wynaut egg, Castform, Beldum, and the fossils (Root/Claw, an exclusive group).
  - **Event-only:** the list above.
  - **`requiresOtherGame`:** Kanto and Johto species with no Hoenn source (FireRed/LeafGreen, Colosseum/XD).
    The validator lists them; group the reason text by source game.
- [ ] **`evolutions.ts`** from pret `evolution.h`: the new kinds from Stage A, held-item trades (Clamperl's
  Deep Sea Tooth/Scale) as `requiresTrade`.
- [ ] **Breeding:** the Route 117 Day Care, with the incense babies.
- [ ] **Unlocks:**
  - HMs (Cut, Flash, Rock Smash, Strength, Surf, Fly, Dive, Waterfall).
  - The Devon Scope, Go-Goggles, Acro and Mach Bikes, Basement Key, Storage Key, Scanner.
  - The Hall of Fame and National Dex gates.
  - Catch-rate note classifications and item requirement phrases.
- [ ] **Prize shop:** the Mauville Game Corner (with the Coin Case unlock).

## Stage D — species and Pokédex data

- [ ] Gen III base stats, catch rates, base experience, growth, gender, egg groups, abilities and Dex entries for
  all three games. Check all 386 species against pret.
- [ ] Learnsets and moves with Gen III move data. Gen III has no physical/special split: the category still
  comes from the type, so `Move` needs no change yet.
- [ ] `type-history.ts`: Gen III uses the Gen II–V types (no Fairy).

## Stage E — items

- [ ] The walkthrough cross-check, triaged overrides, hidden items (Itemfinder) and the Abandoned Ship's keys.
- [ ] `itemNoteRules` for Berry trees, the Lilycove lottery and daily or recurring gifts.
- [ ] The first build writes `rse/item-numbers.json`.

## Stage F — sprites

- [ ] Ruby/Sapphire and Emerald front sprites into `public/sprites/gen3-rs/` and `gen3-e/`. Check the Bulbagarden
  Archives file names first. Emerald's sprites are animated, so they may need `stillFrame`.

## Stage G — `core/mechanics/gen3.ts`

Built against pret, as gen2 was.

- [ ] The Gen III capture formula (four shake checks).
- [ ] Ball set: Net, Dive, Nest, Repeat, Timer, Luxury, Premier, Safari.
- [ ] Status bonuses: 2× sleep/freeze, 1.5× poison/paralysis/burn.
- [ ] The Gen III stat formula with natures and EVs; 1/8192 Shiny odds; the PID traits.
- [ ] Tests from Bulbapedia's worked examples.
- [ ] Fixed IVs or natures for in-game trades, if pret has them.

## Stage H — story checklist (Phase 11 parity)

- [ ] `rse/overrides/milestones.ts`: gyms, Team Magma/Aqua, the weather trio, the Elite Four, the Battle Frontier
  (Emerald only, optional), key items.
- [ ] `rse/milestone-numbers.json`, `storyChecklist: true` on `rse`, goldens.
- [ ] Journey anchors (plan §7.14, §13.13): review the report's Journey section and give each revisit milestone an
  `after` anchor where its default position is wrong.

## Stage I — validation, goldens, report, go live

- [ ] `rse/golden.spec.ts` and `obtainability.golden.spec.ts`: each game's obtainable count with reason lists, the
  starter and fossil exclusive groups, Feebas, the roamer, breeding with incense.
- [ ] Review `reports/rse.md`, the 10-location spot check, then flip the three games to `available`.

## Open research questions

1. Do Ruby/Sapphire outbreaks need record mixing (another player's save)? If so, they are excluded there and
   count only where the game starts them alone. Check Emerald too.
2. Exact Safari Zone areas and the Pokéblock feeder rules: do they change the encounter rates the guide shows?
3. Emerald's post-Hoenn-Dex gift of the Johto starters: confirm the trigger and that it's an exclusive choice.
4. Bulbagarden Archives sprite names for R/S and E.

## Accept when

- `npm run data:build` has 0 errors and triaged warnings, and rby and gsc are unchanged.
- Every species 1–386 is obtainable or has a reason in each game.
- The spot check matches Bulbapedia.
- The Gen III tools match hand-worked examples.
- The user's browser check passes.
