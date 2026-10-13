# Phase 15 — Gen IV: HeartGold, SoulSilver

| | |
|---|---|
| Version group | `hgss` (data file `data/hgss.json`, mechanics `gen4`; see Stage G) |
| Games | HeartGold (codec 15, 2010), SoulSilver (16, 2010) |
| Regions | Johto and Kanto; regional dex "Johto Pokédex" |
| National Dex | 1–493 |
| Depends on | Phase 14 (Gen IV groundwork), Phase 10 (the Johto/Kanto location ids and Gen II method vocabulary) |
| Shared rules | [README](README.md) |

A Gen IV remake of Gold/Silver. The gsc work (Johto and Kanto location ids, Headbutt, the Bug-Catching Contest,
day-of-week conditions, Apricorns) carries over. The new parts are the radio sounds, the HeartGold/SoulSilver
Safari Zone and the Gen IV data.

## Proposed decisions (confirm at the start)

- **One `hgss` group** with one walkthrough. Johto and Kanto **reuse the gsc and rby location ids**. New places get
  new ids: the Safari Zone, Sinjoh Ruins, the Embedded Tower, Cliff Cave, the Pokéathlon Dome…
- **Count as obtainable:**
  - The Hoenn and Sinnoh radio sounds (after the National Dex expansion), swarms, Headbutt groups.
  - The Bug-Catching Contest (Tuesday/Thursday/Saturday) and the Safari Zone.
  - Rock Smash, the roaming beasts.
  - The Kanto starters from Oak and the Hoenn starters from Steven.
  - Static legendaries the game alone can reach.
- **Excluded:** the **Pokéwalker** (an extra device, already decided in plan §19.2) and the Pokéathlon's
  wireless parts.
- **Event-only:**
  - The GS Ball Celebi, the Pikachu-colored and Spiky-eared Pichu.
  - The Enigma Stone Latias/Latios.
  - Arceus, and the Sinjoh Ruins Dialga/Palkia/Giratina that need it.
  - Mew, Jirachi, Deoxys, Darkrai, Shaymin, Manaphy/Phione.
- **Kyogre, Groudon and Rayquaza:** one of Kyogre/Groudon per version, and Rayquaza needs both in the party.
  Proposal: Rayquaza uses Phase 14's `requiresSpecies` and so resolves to `other-version`. Confirm the per-version
  assignment.
- **Open: the Safari Zone.** Its encounters depend on placed block objects and days passed, on custom templates
  (`JohtoSafariZone/h`, `JohtoSafariZoneB1`). Proposal: a dedicated parser that lists each area's slots, with the
  block requirement as a note, not a new condition kind. The fallback is a curated override.
- **Scope: full parity** (README).

## What the research found (2026-10-13)

- `catch/entryhs` (Template revid 4523944): `dex|name|HG|SS|method|levels|morning|day|night`, or `all=`, plus
  `type1`/`type2`, `form=`, `tradenum`/`tradename`/`tradegender`. `10=k`/`10=j` only picks the Headbutt tree icon
  (Kanto or Johto), so the adapter ignores it.
- The cache already has **2,110 `entryhs` rows** from the gsc and rby pages, under `===Generation IV===`.
- Methods seen in the cache:
  - Grass, Headbutt (with `Group A`/`Group B` divs), Cave, Fish Old/Good/Super, Surf, Rock Smash, Gift, Trade,
    Egg.
  - `Hoenn` and `Sinnoh` (the radio sounds, 174 and 153 rows), `Swarm`.
  - Floors, fossils, `Pichu`.
  - The template also lists `Bug` (the contest), `Prize`, `Starter`, `Enigma`, `Special`.
- Divs seen: "While riding a Flying Pokémon", "Sea Skim", "Later visit", "Rare Spawns", "Requires Card Key".
  Some of these are Let's Go tables on the same pages (`catch/entrype`) and must be skipped by template name.
- Johto Safari Zone (revid 4630353): the plain `entryhs` tables cover the base slots. The block-object slots are
  in `JohtoSafariZoneB1` rows under `JohtoSafariZone/h` headers.

## Stage A — generic groundwork

Earlier groups rebuilt byte-identical except `builtAt`.

- [ ] **The `entryhs` adapter**, fixtured from the cache (can start early).
- [ ] **Radio-sound condition:** a new condition kind (`radio`: Hoenn or Sinnoh), shown as a chip.
- [ ] **Safari Zone parser** for the `JohtoSafariZone*` templates, or the override fallback.
- [ ] **Per-version-group ball sets:** HeartGold/SoulSilver bring back the Apricorn balls with fixed or changed
  behavior. Proposal: `mechanicsId: 'gen4-hgss'`, a module that reuses `gen4.ts` and adds those balls (see Stage
  G). The registry's `mechanicsId` changes then.

## Stage B — `version-groups/hgss/` config, locations and walkthroughs

- [ ] Research first (cache-first, since most pages are cached): the category, the walkthrough, the new locations,
  `In-game trade`, the Game Corners and the Johto dex list.
- [ ] Config, locations, walkthrough placement. Kanto parts follow the Johto story as in gsc.
- [ ] Fixtures, snapshot, registration.

## Stage C — curated overrides

Each override records its source page and revid, plus a pret `pokeheartgold` reference where that disassembly
covers it (it's unfinished; check its state at the time).

- [ ] **`encounters.ts`:**
  - **Statics:** Lugia, Ho-Oh, Suicune, the Red Gyarados, Sudowoodo, Snorlax, the Kanto birds, Mewtwo,
    Kyogre/Groudon, Rayquaza.
  - **Roamers:** Raikou, Entei, and Latias/Latios if not event-only.
  - **Gifts:** starters (all three sets), the Togepi egg, Eevee, Tyrogue, Shuckle, Dratini, the Mystery Egg…
  - The exclusive groups.
  - Event-only and `requiresOtherGame`.
- [ ] **`evolutions.ts`:** Gen IV kinds; `requiresTrade` edges.
- [ ] **Breeding:** the Route 34 Day Care, Gen IV incense babies.
- [ ] **Unlocks:** HMs (including Rock Climb and Whirlpool), the Squirtbottle, Pass, Card Key, National Dex /
  radio expansion, Clear Bell/Tidal Bell. Item phrases, catch-rate notes.
- [ ] **Prize shops:** both Game Corners (the international versions' prizes), the Pokéathlon Dome shop (items).

## Stage D — species and Pokédex data

- [ ] Gen IV data shared with dppt, HeartGold/SoulSilver Dex entries, learnsets with their tutors.

## Stage E — items

- [ ] Cross-check, overrides, hidden items.
- [ ] Apricorn and Berry trees as notes (gsc's rules are a starting point).
- [ ] Pokégear call gifts as notes.
- [ ] The first build writes `hgss/item-numbers.json`.

## Stage F — sprites

- [ ] HeartGold/SoulSilver front sprites into `gen4-hgss/`. Check the archive names.

## Stage G — mechanics

- [ ] `gen4-hgss`: the `gen4` capture formula plus the HeartGold/SoulSilver Apricorn balls (Level, Lure, Moon,
  Friend, Love, Heavy, Fast) and the Sport Ball. Use their HeartGold/SoulSilver behavior, not Gen II's bugs.
- [ ] Park Ball: Pal Park only, so leave it out.

## Stage H — story checklist

- [ ] Milestones: Johto gyms, Team Rocket, the Kimono Girls and the legendary bird, the Elite Four, Kanto gyms,
  Red. Optional extras: the Pokéathlon, Battle Frontier, Safari Zone.
- [ ] gsc's milestones are a starting point, but numbers are per group.
- [ ] Numbers file, flag, goldens.

## Stage I — validation, goldens, report, go live

- [ ] Goldens:
  - Each game's counts.
  - Radio and swarm conditions.
  - Headbutt groups.
  - The contest on its days.
  - Safari Zone areas.
  - Rayquaza's `requiresSpecies`.
  - The Pokéwalker exclusion (species only from the Pokéwalker carry `requires-other-game` or a new
    `extra-device` reason; decide in Stage A).
- [ ] Report, spot check, flip to `available`.

## Open research questions

1. A reason for Pokéwalker-only species: reuse `requires-other-game` ("Pokéwalker") or add `extra-device`? Adding a
   reason is a data-schema change (no export contract involved).
2. Which version gets Kyogre and which gets Groudon, and how roaming Latias/Latios work in each version.
3. Safari Zone: are the block-object slots worth listing per block, or is "needs objects placed" enough?
4. Time-of-day hours (shared question with Phase 14).

## Accept when

- 0 errors, triaged warnings, earlier groups unchanged.
- Every species 1–493 is obtainable or has a reason in each game.
- The radio, swarm and Safari Zone entries display correctly.
- The spot check matches.
- The Apricorn balls match hand-worked examples.
- The user's browser check passes.
