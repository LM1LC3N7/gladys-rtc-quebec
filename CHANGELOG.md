# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Fixed

- The status line says why no stop was found (no house location, location
  refused) even when the line status is the only device.

## [0.1.0] - 2026-10-11

### Added

- First version, derived from gladys-stm (STM Montréal) and gladys-translink.
- Next departures of every RTC stop, from the RTC timetable through
  Transitous: no account, no key.
- àVélo stations: bikes, e-bikes and free docks.
- The closest stops and àVélo stations suggested from the house location.
- Stop search by name or number, in the stop list shipped with the image.
- Dashboard widgets, scene triggers and scene action (Gladys 5.1.0+).

[Unreleased]: https://github.com/LM1LC3N7/gladys-rtc-quebec/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/LM1LC3N7/gladys-rtc-quebec/releases/tag/v0.1.0
