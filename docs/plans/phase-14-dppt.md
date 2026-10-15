# Phase 14 — Gen IV: Diamond, Pearl, Platinum

| | |
|---|---|
| Version group | `dppt` (data file `data/dppt.json`, mechanics `gen4`) |
| Games | Diamond (codec 12, 2007), Pearl (13, 2007), Platinum (14, 2009) |
| Region | Sinnoh; regional dex "Sinnoh Pokédex" (Platinum's is longer and numbered differently) |
| National Dex | 1–493 |
| Depends on | Phase 12 (Gen III groundwork). Carries the **Gen IV groundwork** that Phase 15 (HeartGold/SoulSilver) reuses. |
| Shared rules | [README](README.md) |

The first Gen IV row. New generic pieces:

- the physical/special split on moves
- time-of-day hours per version group
- forms on encounter rows
- encounters that require other species
- the `gen4` mechanics module

## Proposed decisions (confirm at the start)

- **One `dppt` group**, with Platinum placed from its own walkthrough (like Crystal and Emerald). Platinum's
  Sinnoh Dex numbering differs, so `regionalDex` must be read **per game**, not per group.
- **Count as obtainable:**
  - Poké Radar chains (after the National Dex), swarms, Honey trees, the Great Marsh and Trophy Garden daily
    species.
  - Feebas tiles (Mt. Coronet), Underground fossils, the Old Chateau, Rotom.
  - Roaming Mesprit and Cresselia (and Platinum's roaming birds, if confirmed).
  - Every static legendary that the game alone can reach.
- **Open: dual-slot.** Some encounters need a Gen III cartridge in the DS's GBA slot (the `FR` method on Sinnoh
  Route 201, Sinnoh Route 201 revid 4633683). Proposal: **exclude them**, with `requires-other-game` naming the
  GBA game, since they need a second game the player may not own. The alternative is a togglable "I own the GBA
  game" setting, which would make obtainability depend on the profile.
- **Open: Spiritomb.** It needs the Odd Keystone and 32 conversations in the Underground. Confirm that these can be
  done without other players; otherwise it's `requires-other-game`-like (needs other players).
- **Encounters that need other species**, e.g. Regigigas needing the three Regis, or Platinum's Regis needing
  Regigigas. Proposal: a generic `requiresSpecies` on encounters, satisfied only when those species are
  obtainable in the same game. A cycle with no outside source then resolves to unobtainable with a clear reason.
- **Event-only:** Darkrai, Shaymin, Arceus, Manaphy (and so Phione, which only breeds from Manaphy), Mew, Celebi,
  Jirachi, Deoxys.
- **Pal Park is excluded** (README), so most pre-Gen IV species are `requires-other-game` until the National Dex
  wild areas cover them.
- **Forms** (Shellos/Gastrodon East/West, Burmy cloaks, Wormadam, Unown, Cherrim, Platinum's Rotom and Giratina
  forms) are notes and form labels on rows. The checklist stays per species.

## What the research found (2026-10-13)

- `catch/entry4` (Template revid 4523981): `dex|name|D|P|Pt|method|levels|morning|day|night`, or `all=` for one
  rate, plus `type1`/`type2` and `form=`.
- The method switch lists: `Grass`, `Surf`, `Cave`, `Fish Old/Good/Super`, `Rock Smash`, `Gift`, `Starter`,
  `Swarm`, `Building`, `Poké Radar`, `Honey`, `Backlot` (Trophy Garden), `Odd Keystone`, `Prize`, `Egg`, the
  fossils, and the dual-slot games (`FR` etc.).
- Sinnoh Route 201 uses `====Generation IV====` under `===Pokémon===`. Rates like `all=One` mark gifts.
- The Great Marsh (revid 4614031) is plain `entry4` tables, about ten of them (one per area and daily set). The
  daily rotation needs a condition or a note.

## Stage A — Gen IV groundwork

Earlier groups rebuilt byte-identical except `builtAt`.

- [ ] **Model and schema:**
  - `Move.category` (`physical` / `special` / `status`), shown from Gen IV on. Earlier generations derive it from
    the type and leave the field out.
  - `form` on slots, as a label only.
  - `requiresSpecies` on encounters.
  - `EvolutionEdge` kinds: location (Magnezone, Probopass, Leafeon, Glaceon), move known (Ambipom, Yanmega…),
    held item at a time of day (Gligar, Sneasel), gender-specific (Gallade, Froslass, Wormadam/Mothim).
- [ ] **Time of day per version group:**
  - The `time` column's hours move from a Gen II constant into the version group (or the features).
  - Gen IV's hours differ from Gen II's. Confirm DPPt's and HGSS's periods.
- [ ] **Vocabularies:**
  - Methods `poke-radar`, `honey-tree`, `underground`.
  - `swarm` reused.
  - A daily-rotation condition for the Great Marsh and Trophy Garden, or location notes. Decide in Stage B.
- [ ] **Pipeline:**
  - The `entry4` adapter: form suffixes in dex numbers, `form=`, and evaluating or rejecting parser functions in
    a dex field.
  - Learnset columns for D/P vs Pt, Platinum's tutors.
  - The Gen IV Dex entries.
- [ ] **App UI:**
  - The move category on learnset and move views.
  - Form labels on encounter rows.
  - The "requires these species" text on encounters.

## Stage B — `version-groups/dppt/` config, locations and walkthroughs

- [ ] Research first: the category, both walkthroughs, about 10 Sinnoh pages, `In-game trade`, the Veilstone Game
  Corner, the Sinnoh dex lists (both numberings), the Underground and Honey tree pages.
- [ ] Config, locations (all new Sinnoh ids, plus the Distortion World for Platinum), walkthrough placement per
  game.
- [ ] Fixtures, snapshot, registration.

## Stage C — curated overrides

Each override records its source page and revid, plus a pret `pokeplatinum`/`pokediamond` reference where the
disassembly covers it.

- [ ] **`encounters.ts`:**
  - **Statics:** Dialga/Palkia, Giratina, Uxie, Azelf, Heatran, Regigigas, the Regis, Rotom, Spiritomb (if it
    counts), Drifloon (Fridays at the Valley Windworks).
  - **Roamers.**
  - **Gifts:** starters, the Togepi egg (Cynthia), the Riolu egg (Riley), Eevee (Platinum), the Porygon gift
    (Platinum), the fossils by version.
  - The exclusive groups.
  - Event-only and `requiresOtherGame`.
- [ ] **`evolutions.ts`:** the new kinds, `requiresTrade` edges (including Gen IV's held-item trades: Electivire,
  Magmortar, Rhyperior, Dusknoir, Porygon-Z).
- [ ] **Breeding:** the Solaceon Day Care, the incense babies (Munchlax, Happiny, Mime Jr., Bonsly, Mantyke,
  Chingling, Budew), Phione from Manaphy (event).
- [ ] **Unlocks:**
  - HMs including Defog and Rock Climb.
  - The Poké Radar, National Dex, Secret Potion.
  - Platinum's Distortion World.
  - Item phrases and catch-rate notes.
- [ ] **Prize shop:** the Veilstone Game Corner.

## Stage D — species and Pokédex data

- [ ] Gen IV base data (493 species), abilities, Dex entries per game, learnsets, moves with categories. Check
  against pret where the disassembly covers it, and against Bulbapedia elsewhere.

## Stage E — items

- [ ] Cross-check, overrides, hidden items, Berry notes. Underground spheres and plates are random, so they are
  notes. The first build writes `dppt/item-numbers.json`.

## Stage F — sprites

- [ ] Diamond/Pearl and Platinum front sprites into `gen4-dp/` and `gen4-pt/`. Check the archive names.

## Stage G — `core/mechanics/gen4.ts`

- [ ] The Gen IV capture formula, built against the disassembly.
- [ ] New balls: Dusk, Quick, Heal; Cherish is event-only.
- [ ] Stats as in Gen III; Shiny 1/8192.
- [ ] The Masuda method needs a foreign-language parent, so it's out of scope; mention it as a note only.
- [ ] Characteristics in the IV tool.

## Stage H — story checklist

- [ ] Milestones per game: gyms, Team Galactic, the lake trio, Spear Pillar, Platinum's Distortion World, the
  Elite Four, the Battle Zone (optional).
- [ ] Numbers file, flag, goldens.
- [ ] Journey anchors (plan §7.14, §13.13): review the report's Journey section and give each revisit milestone an
  `after` anchor where its default position is wrong.
- [ ] Battle teams (plan §7.14, Phase 19): give each `gym` and `battle` milestone whose part page has a `{{Party}}`
  block a `trainer`, then check the report's "Story battles" table (no unclaimed parties without a reason). Extend
  `core/parties.ts` if the pages use another party template.

## Stage I — validation, goldens, report, go live

- [ ] Goldens: each game's counts, dual-slot exclusion, the Poké Radar and swarm gates, `requiresSpecies` cycles,
  per-game regional numbers.
- [ ] Report, spot check, flip to `available`.

## Open research questions

1. Which time-of-day hours do Diamond/Pearl/Platinum use, and do they match HeartGold/SoulSilver?
2. Platinum's legendary chain: can the Regis and Regigigas be obtained without events or transfers?
3. Which species need Pal Park only, per game. That decides how large the `requires-other-game` list is.
4. The Underground's fossil tables per version and per National Dex status.

## Accept when

- 0 errors, triaged warnings, earlier groups unchanged.
- Every species 1–493 is obtainable or has a reason in each game.
- Time-of-day columns use Gen IV's hours.
- The spot check matches.
- The Gen IV tools match hand-worked examples.
- The user's browser check passes.
