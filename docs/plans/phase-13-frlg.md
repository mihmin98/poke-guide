# Phase 13 — Gen III: FireRed, LeafGreen

| | |
|---|---|
| Version group | `frlg` (data file `data/frlg.json`, mechanics `gen3`) |
| Games | FireRed (codec 10, 2004), LeafGreen (11, 2004) |
| Regions | Kanto and the Sevii Islands; regional dex "Kanto Pokédex" |
| National Dex | 1–386 |
| Depends on | Phase 12 (the Gen III groundwork and `gen3` mechanics) |
| Shared rules | [README](README.md) |

A Gen III remake of Red/Blue: Kanto's locations and story are already modeled in rby, so the new parts are the
Sevii Islands, the National Dex gate and the Gen III data. Little generic work is expected, apart from the two
gates below.

## Proposed decisions (confirm at the start)

- **One `frlg` group.** The games share one walkthrough. Kanto **reuses the rby location ids** (as gsc did), and
  the Sevii Islands get new ids under region `sevii`.
- **The National Dex gate:**
  - Johto species on the Sevii Islands appear only after the National Dex (Hall of Fame plus the Sevii story).
  - **Kanto Pokémon don't evolve into non-Kanto species before the National Dex** (Golbat → Crobat, Chansey →
    Blissey, Eevee → Espeon/Umbreon…).
  - Proposal: one `national-dex` unlock, used both on encounters and as an evolution-edge condition.
- **Linked exclusives:** the roaming beast is decided by the starter choice. Proposal: a generic **linked
  exclusive group**, where picking option *i* of one group decides option *i* of another, so "max in one save"
  counts the starter and its beast together.
- **Exclusive groups also cover** the Saffron Dojo Hitmon choice and the Helix/Dome fossil. The Old Amber is
  separate.
- **Event-only:** Mew, Deoxys (Birth Island, Aurora Ticket), Lugia and Ho-Oh (Navel Rock, Mystic Ticket).
- **`requiresOtherGame`:** Hoenn species (Ruby/Sapphire/Emerald), and Johto species with no Sevii source.
- **Scope: full parity** (README).

## What the research found (2026-10-13)

- `catch/entryfl` (Template revid 4027966): `dex|name|FR|LG|method|levels|rate`, plus `type1`/`type2` and
  `tradenum`/`tradename`. That's the same shape as `entry1` without the third game.
- The cache already holds 723 `entryfl` rows from the rby Kanto pages, under `===Generation III===`.
- Methods seen in the cache:
  - Grass, Fish Old/Good/Super, Cave, Surf, Rock Smash, Gift, Trade, Building.
  - The fossils (`Helix`, `Dome`, `Amber`).
  - Floor labels (`B1F`, `1F-3F`, `7F`…), the same trap as rby.
- The template also has `Prize`, `Egg`, `Starter`, `Special` and the event tickets (`Mystic`, `Aurora`).

## Stage A — generic groundwork

rby, gsc and rse rebuilt byte-identical except `builtAt`.

- [ ] **The `entryfl` adapter**, with a fixture from the cached pages (work that can start before Stage B).
- [ ] **The `national-dex` gate on evolution edges:**
  - An `EvolutionEdge.requires` unlock, read by the obtainability closure.
  - Evolutions locked behind it still count, once the unlock is reachable in the game.
- [ ] **Linked exclusive groups** in `EncounterOverrides` and the engine's "max in one save" (§9).
- [ ] **Region `sevii`:** the guide groups parts by region, so check that Kanto → Sevii → Kanto ordering works.

## Stage B — `version-groups/frlg/` config, locations and walkthroughs

- [ ] Research first (cache-first): the location category, the walkthrough, the Sevii pages, `In-game trade`, the
  Celadon Game Corner and the Kanto dex list.
- [ ] `config.ts`, `locations.ts` and `walkthrough.ts`. Some Kanto pages may need Gen III-only sub-areas or ids,
  such as Mt. Ember (Sevii) and Tanoby Ruins.
- [ ] Fixtures, the category snapshot, registration.

## Stage C — curated overrides

Each override records its source page and revid, plus a pret `pokefirered` reference.

- [ ] **`encounters.ts`:**
  - **Statics:** the Snorlaxes, the Kanto birds, Mewtwo, the Power Plant Electrodes, the Hypno of Berry Forest
    if it's catchable, Tanoby's Unown.
  - **Roamers:** Entei, Raikou or Suicune, linked to the starter.
  - **Gifts:** starters, Eevee, Lapras, the Magikarp salesman, the Togepi egg, Hitmons, fossils.
  - Event-only and `requiresOtherGame`, as decided above.
- [ ] **`evolutions.ts`:** Gen III kinds from Phase 12, `requiresTrade` edges, the `national-dex` gate on non-Kanto
  targets.
- [ ] **Breeding:** the Route 5 Day Care and the Four Island Day Care. Check that both exist and what each needs.
- [ ] **Unlocks:** HMs, Poké Flute, Silph Scope, Card Key, Tea, Rainbow and Tri Pass, National Dex. Plus
  catch-rate notes and item phrases.
- [ ] **Prize shops:** the Celadon Game Corner. Prizes differ between FireRed and LeafGreen.

## Stage D — species and Pokédex data

- [ ] FireRed and LeafGreen Dex entries.
- [ ] Learnsets, with FireRed/LeafGreen tutor moves (including the ultimate moves and the one-time tutors).
- [ ] Base data shared with rse, checked against pret.

## Stage E — items

- [ ] Cross-check, overrides, hidden items, Sevii items, Berry notes. The first build writes
  `frlg/item-numbers.json`.

## Stage F — sprites

- [ ] FireRed/LeafGreen front sprites into `public/sprites/gen3-frlg/`. Check the archive names.

## Stage G — mechanics

- [ ] `mechanicsId: 'gen3'`, reused. Check whether the Safari Zone's capture rules match rse's or need a
  FireRed/LeafGreen-specific input.
- [ ] Fixed IVs or natures for in-game trades.

## Stage H — story checklist

- [ ] `frlg/overrides/milestones.ts`: the Kanto story (its rby milestones are a starting point, but numbers are
  per group), the Sevii story, the National Dex.
- [ ] `frlg/milestone-numbers.json`, `storyChecklist: true`, goldens.

## Stage I — validation, goldens, report, go live

- [ ] Goldens: each game's counts, the linked starter–beast group, the National Dex gate on evolutions and on
  Sevii encounters, version exclusives.
- [ ] Report review, 10-location spot check, flip to `available`.

## Open research questions

1. Does any Johto species appear on Sevii *before* the National Dex? That decides whether the gate applies per
   encounter or per location.
2. How does the Pokédex gate interact with breeding? Does a Kanto parent's egg hatch into a non-Kanto baby (Pichu,
   Igglybuff…) before the National Dex?
3. The exact starter → beast mapping, and whether the beast appears before or after the Sevii story.
4. Which Hoenn species are wild in FireRed/LeafGreen at all, besides those from Altering Cave events.

## Accept when

- 0 errors, triaged warnings, earlier groups unchanged.
- Every species 1–386 is obtainable or has a reason in each game.
- The linked group's "max in one save" is right.
- The National Dex gate shows on the evolutions and encounters it locks.
- The spot check matches.
- The user's browser check passes.
