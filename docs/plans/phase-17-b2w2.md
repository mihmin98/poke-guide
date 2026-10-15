# Phase 17 — Gen V: Black 2, White 2

| | |
|---|---|
| Version group | `b2w2` (data file `data/b2w2.json`, mechanics `gen5`) |
| Games | Black 2 (codec 19, 2012), White 2 (20, 2012) |
| Region | Unova; regional dex "New Unova Pokédex" |
| National Dex | 1–649 |
| Depends on | Phase 16 (Gen V groundwork, Unova location ids, `gen5` mechanics) |
| Shared rules | [README](README.md) |

The sequels share Unova with Black/White, so most location ids, the vocabulary and the mechanics carry over. The
new parts:

- the new and changed areas
- Hidden Grottoes
- the key system
- the many Unova Link features that the scope rules exclude

## Proposed decisions (confirm at the start)

- **One `b2w2` group**, one walkthrough. Reuse Phase 16's Unova ids. New places get new ids: Aspertia,
  Virbank, Castelia Sewers, Floccesy, Reversal Mountain, Strange House, Humilau, Seaside Cave, the Plasma Frigate,
  the Marine Tube, the Nature Preserve and others.
- **Hidden Grottoes count.** They are a method (`hidden-grotto`), and their gender-specific and rare slots become
  conditions or notes. Decide in Stage A.
- **Count as obtainable:**
  - The Pokémon World Tournament prizes (items).
  - Join Avenue shops (items, if their stock can be reached without other players).
  - The Nature Preserve's guaranteed Shiny Haxorus (a static with `shiny: true`, like gsc's Red Gyarados).
  - The post-game legendaries reachable in each version.
- **Excluded:** Memory Link (needs a Black/White save), the Pokémon Dream Radar (a separate 3DS app), Unova Link
  key exchange with another player, Funfest Missions that need the C-Gear with others, Global Link, Poké Transfer.
- **Open: the key system.** Each version unlocks one of each key pair by itself: Challenge or Easy Mode, the Iron
  or Iceberg Chamber (Registeel or Regice), White Treehollow or Black Tower. The other half needs a key from
  another player's game. Proposal: content behind the other key gets the `other-version` reason, so the
  Regice/Registeel split is a version exclusive.
- **The Shiny Charm** (after completing the National Dex) is effectively out of reach without trading. Proposal: the
  Gen V Shiny section mentions it as a note, and the tool doesn't offer it.
- **Sprites:** Black 2/White 2 reuse the Black/White sprites for most species. If the archive confirms the sets are
  identical, point `spriteSetId` at `gen5-bw` (not a contract) and drop `gen5-b2w2`.
- **Scope: full parity** (README).

## What the research found (2026-10-13)

- `catch/entry5-2` (Template revid 4027975):
  - `dex|name|B2|W2|method|levels|spring|summer|autumn|winter`, or `all=`, plus `type1`/`type2`, `form=` and
    `formlink=`.
  - Only **two** game flags: unlike `entry5`, there's no unused fifth positional.
- The method switch is `entry5`'s plus `Grotto` (Hidden Grotto).
- Sections are the `===Pokémon Black 2 and White 2===` game headings on the shared Unova pages (Phase 16's
  walker option). Unova Route 1 (revid 4613220) has a B2W2 table with higher levels, phenomena and rippling
  water; Route 6 has season columns.

## Stage A — generic groundwork

Earlier groups rebuilt byte-identical except `builtAt`.

- [ ] **The `entry5-2` adapter.**
- [ ] **The `hidden-grotto` method**, and how its slots render: a grotto has several groups and gender-specific
  encounters.
- [ ] **`other-version` from a key:** an unlock that only the other version grants, read by the obtainability
  closure as `other-version`, not `not-in-game`.

## Stage B — `version-groups/b2w2/` config, locations and walkthroughs

- [ ] Research first: the category, the walkthrough, the new areas, `In-game trade`, the New Unova dex list,
  Hidden Grotto pages, the key system and the PWT.
- [ ] Config, locations, walkthrough placement.
- [ ] Fixtures, snapshot, registration.

## Stage C — curated overrides

Each override records its source page and revid.

- [ ] **`encounters.ts`:**
  - **Statics:** Kyurem, Reshiram/Zekrom (post-game), Latios/Latias, the lake trio, Heatran, Cresselia, the Regis
    by key, Regigigas (`requiresSpecies`), the Swords of Justice, Volcarona, the Shiny Haxorus.
  - **Gifts:** starters, the Eevee, Zorua and Deerling gifts…
  - **In-game trades:** they changed from Black/White.
  - Event-only (Victini, Keldeo, Meloetta, Genesect…) and `requiresOtherGame`.
- [ ] **`evolutions.ts`:** as `bw`; check the differences.
- [ ] **Breeding:** the Route 3 Day Care.
- [ ] **Unlocks:**
  - HMs, the post-game areas.
  - The keys: own version available, other version `other-version`.

## Stage D — species and Pokédex data

- [ ] Black 2/White 2 Dex entries, learnsets with the B2W2 move tutors (paid in shards), base data shared with
  bw.

## Stage E — items

- [ ] Cross-check, overrides, hidden items, Hidden Grotto items (they respawn, so they are notes or one tick per
  grotto; decide).
- [ ] PWT and Join Avenue as purchases or notes.
- [ ] The first build writes `b2w2/item-numbers.json`.

## Stage F — sprites

- [ ] Reuse `gen5-bw` if identical; otherwise download `gen5-b2w2/` with still frames.

## Stage G — mechanics

- [ ] `gen5` reused. The Shiny Charm is a note only (see above).

## Stage H — story checklist

- [ ] Milestones: gyms (a different set from Black/White), Neo Team Plasma, the Plasma Frigate, Kyurem, the Elite
  Four.
- [ ] Optional extras: the PWT, Join Avenue, Medals, the Hidden Grotto rounds.
- [ ] Numbers file, flag, goldens.
- [ ] Journey anchors (plan §7.14, §13.13): review the report's Journey section and give each revisit milestone an
  `after` anchor where its default position is wrong.

## Stage I — validation, goldens, report, go live

- [ ] Goldens:
  - Each game's counts.
  - The key exclusives as `other-version`.
  - Hidden Grotto slots.
  - The Shiny Haxorus.
  - Regigigas' `requiresSpecies`.
- [ ] Report, spot check, flip to `available`.

## Open research questions

1. Which content each version unlocks without another player's key, confirmed per version.
2. Can Join Avenue shops reach their useful ranks without other players' visitors?
3. Which Funfest Missions can be done solo, and do any give Pokémon or items that matter here?
4. Are the Black 2/White 2 sprites identical to Black/White's for all 649 species?

## Accept when

- 0 errors, triaged warnings, earlier groups unchanged.
- Every species 1–649 is obtainable or has a reason in each game.
- Key content is marked as the other version's.
- The spot check matches.
- The user's browser check passes.
