# Changelog

All notable changes to Poké Guide. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version numbers follow the rules in [plan §17.1](IMPLEMENTATION_PLAN.md#171-versioning-and-releases): MAJOR when something a user holds stops working, MINOR for new capabilities, PATCH for fixes and data corrections.

## [Unreleased]

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

[Unreleased]: https://github.com/mihmin98/poke-guide/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mihmin98/poke-guide/releases/tag/v1.0.0
