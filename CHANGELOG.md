# Changelog

All notable changes to Poké Guide. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version numbers follow the rules in [plan §17.1](IMPLEMENTATION_PLAN.md#171-versioning-and-releases): MAJOR when something a user holds stops working, MINOR for new capabilities, PATCH for fixes and data corrections.

## [Unreleased]

### Added

- **Coming Soon games:** the Games page now lists the games still to come: Ruby, Sapphire and Emerald; FireRed and LeafGreen; Diamond, Pearl and Platinum; HeartGold and SoulSilver; Black and White; Black 2 and White 2. They can't be opened yet.
- **The Story shows the road between milestones:** the areas you pass between two story steps, with the Pokémon and items you can get there by that point and what opens up later. After a milestone that unlocks something (Surf, a fishing rod, a key), a note lists the earlier areas worth going back to, as long as they still hold something you need. "Hide finished areas" keeps the list short.
- **Story links:** on a wide screen, an area opens beside the Story, as in the Guide; on a phone, Back returns to the Story. A link can point straight at a part or a milestone (`/red/story#m-gym-misty`).
- **Story steps in the Guide:** gyms, battles and events now sit between the Guide's locations, with the same tick box as on the Story page; "Show story" (also in Settings) hides them. Each part's header links to that part of the Story.
- **When you get there:** a location page now says which story steps come just before and after it, linking to them in the Story.
- **Story battle teams:** gyms, rival battles, Team Rocket bosses, the Elite Four and the Champion now show the trainer's team on the Story page and on location pages: each Pokémon's level, gender and moves, plus the prize money. Rival teams have a tab per starter (or, in Yellow, per evolution of his Eevee), opening on the starter you've marked caught. Legendary and other one-off encounters and gifts show their level, and the Guide's story steps show the level range.

### Changed

- The Games page shows each game's release year next to its name and puts each set of versions on its own row, in release order.

## [1.1.0] - 2026-10-13

### Added

- **Story checklist for Gold, Silver and Crystal:** gyms, rival and Team Rocket battles, the Elite Four, the Kanto journey up to Red, key items, gifts and legendary encounters, part by part. Optional extras cover the roaming beasts, the Bug-Catching Contest, the Pokégear cards and the Unown puzzles.
- **Indigo Plateau** in the Gold, Silver and Crystal guide, where the Elite Four milestones live.

## [1.0.0] - 2026-10-13

The first public release.

### Added

- **Games:** Red, Blue and Yellow; Gold, Silver and Crystal.
- **Guide:** every location in walkthrough order, with encounter tables per method and time of day, levels, rates, types and catch rates, plus static encounters, gifts, in-game trades and the items found there.
- **Checklist:** the Pokémon each game can obtain without trading with another player, with a "max in one save" figure for exclusive choices and a reason for every Pokémon you can't obtain.
- **Pokémon pages:** catch rate, base stats, evolution line, Pokédex entries, learnsets and where to find each one.
- **Item tracking:** tick off the items picked up in each area.
- **Story checklist (Red, Blue and Yellow):** the story milestones part by part, with a prompt to move your progress along.
- **Profiles:** several named playthroughs saved in the browser, each tied to a game.
- **Import and export:** short `PKG` export codes, share links, QR codes and JSON backups.
- **Tools:** a catch chance calculator and an IV/DV calculator that follow each generation's own formulas.
- **Offline:** an installable PWA that keeps working without a connection, with a prompt when a new version is ready.
- Per-game color themes in light and dark mode.

### Compatibility

Saved state schema 3, export codes `PKG1`–`PKG3` and data file schema 1. Every later 1.x release keeps reading all of them.

[Unreleased]: https://github.com/mihmin98/poke-guide/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/mihmin98/poke-guide/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mihmin98/poke-guide/releases/tag/v1.0.0
