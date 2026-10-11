# CLAUDE.md

Guidance for Claude Code (and any other contributor) working in this repository.

## What this project is

An **external Gladys Assistant integration** for Québec City public transit
(RTC, Réseau de transport de la Capitale). It runs as a Docker container next
to a Gladys instance, talks to Gladys through the official SDK
(`@gladysassistant/integration-sdk`), and publishes **read-only** devices: one
per watched stop, one per watched àVélo station.

Not affiliated with the RTC nor with the City of Québec. Data: the RTC static
GTFS (shipped as a stop table in `gtfs/`), Transitous (keyless: departures
and stop descriptions) and the open àVélo GBFS feed. No key anywhere.

**Inactive shared modules.** The RTC publishes no real-time feed and no
service alerts in the open: `NETWORK.realtime` is null and `NETWORK.lines`
empty. `src/api/realtime.js`, `src/api/lines.js`, `src/api/gtfsRealtime.js`
and `src/devices/lineStatus.js` stay, unused, to keep the code identical to
the sister repositories (they are tested in gladys-translink); the manifest
declares no key, no key test, no line trigger, action or widget.

**Design goal: usable by somebody who is not technical.** Nothing to type to
start: the house location (`location: true`) gives the suggested stops and
stations, there is no key, and the connection status line
(`src/status.js`) always says what to do next. Keep it that way: every new
setting needs a default that works, and every failure a message that says what
to do.

**Sister integrations.** `gladys-translink` (Vancouver), `gladys-octranspo`
(Ottawa) and `gladys-rtc-quebec` (Québec) share this code base, derived from
`gladys-stm` (Montréal). Everything that names the network lives in
`src/network.js`, its data in `gtfs/`, its texts in the manifest and the docs:
the rest of the code is identical in the three repositories, and a fix to it
belongs in the three (and in gladys-stm when it applies there).

## Commands

```bash
npm ci
npm test               # node --test, no framework, no network access
npm run lint           # eslint
npm run format         # prettier --write .
npm run format:check   # what CI checks
npm run update-stops   # regenerate gtfs/ from the RTC static GTFS (network)
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run `npm test`, `npm run lint` and `npm run format:check` before every commit:
CI (`.github/workflows/ci.yml`) runs the three. The CI minutes are counted:
batch the pushes (one push a day at most, unless asked otherwise).

## Layout

```
index.js                      SDK wiring only: handlers, connect, status
src/network.js                the network: operator, feeds, key, lines, bike share
src/config.js                 defaults, type coercion, watch-list mini-syntax, request estimate
src/api/http.js               fetch with timeout and User-Agent
src/api/stops.js              the stop table (gtfs/): code → stop_ids, search, nearby, route labels
src/api/gtfsRealtime.js       minimal GTFS-Realtime decoder (watched stops only; alerts)
src/api/realtime.js           operator feeds with the key: departures, shared feed cache, errors
src/api/lines.js              line status from the service alerts
src/api/bikes.js              bike share GBFS client, per-cycle cache, station search
src/api/transitous.js         Transitous: departures of a stop code, descriptions
src/status.js                 the connection status line: what the user must do next
src/devices/index.js          device registry (typed + suggested + created) + manifest actions
src/devices/suggestions.js    the stops and bike stations closest to the house
src/devices/stop.js           one device per watched stop
src/devices/lineStatus.js     the line status device
src/devices/bikeStation.js    one device per watched bike station
src/devices/pollSchedule.js   drops the poll ticks inside the configured interval
src/devices/stateCache.js     drops the states that did not move since the last read
src/devices/publish.js        publishes only to the features the created device has
src/devices/readings.js       last reading per device, shared with the widgets
src/devices/refreshLoop.js    the container's own ticker over the created devices
src/scenes/triggers.js        scene events, computed between two polls of a device
src/scenes/actions.js         scene actions: a fresh read handed to the scene
src/widgets/index.js          dashboard widgets
scripts/update-stops.mjs      generates gtfs/ from the static GTFS (ZIP + CSV, no dependency)
gtfs/                         the stop table, shipped with the image
test/                         node:test suites; helpers: fake SDK, fetch stub, GTFS-RT encoder, fixtures
docs/en.md, docs/fr.md        user documentation (re-hosted by Gladys)
gladys-assistant-integration.json   the store manifest
```

Keep the separation: `index.js` holds no transit logic, `src/api/` only reads
the sources, `src/devices/` only turns a reading into features, `src/scenes/`
and `src/widgets/` only turn a blueprint's `read` into events, outputs and
cards.

## Data sources: what is known and how

- **Stop codes**: the 4-digit number on the RTC sign; the GTFS `stop_id` is
  `1-<code>` (checked on the static GTFS of 2026-10: 4,316 codes). The
  `stop_name` repeats the code ("Champlain/1005"): the table takes the
  `stop_desc`, the corner ("Rue Champlain / boul. Champlain").
- **Routes**: `route_id` is `1-<short name>` (`1-800` is the Métrobus 800).
- **Real time**: none in the open (the RTC keeps it in its Nomade app). The
  boards show scheduled times ("~"). If the RTC opens a GTFS-Realtime feed,
  fill `NETWORK.realtime` (see gladys-translink and gladys-octranspo) and
  generate the manifest's key fields.
- **Licence**: the RTC asks for the mention "Application, produit ou service,
  intégrant les Informations publiques du Réseau de transport de la Capitale,
  mises à jour le …" with the date of the data: update it in the README, the
  NOTICE and the docs with every `npm run update-stops`.
- **àVélo**: the PBSC system of BIXI, GBFS 2.3 at
  `quebec.publicbikesystem.net/customer/gbfs/v2/gbfs.json` (also 3.0, not
  used: the client reads 2.x). Station ids are short digit strings, true
  booleans; the e-bikes are the `vehicle_types_available` whose
  `propulsion_type` is electric.
- **Transitous**: ids are `ca-qc-RTC_1-<code>`. No real time for the RTC
  (`realTime: false`). `/v5/stoptimes` answers for a group of stops: the
  departures are filtered on the code's own stop_ids. Usage policy:
  open-source non-commercial, User-Agent with a contact, stay light — keep the
  caches and the 120 s floor (`MIN_SCHEDULE_POLL_FREQUENCY`).

## Conventions

- ES modules, Node >= 22, no runtime dependency besides the SDK. Do not add
  one without a strong reason (the 256 MB sandbox is why the GTFS-RT decoder is
  hand-written).
- Prettier decides formatting; ESLint decides the rest.
- Comments explain **why**, in full sentences, in English.
- Every user-visible string in the manifest, actions and widgets is bilingual
  (`{ en, fr }`); text features follow the `language` setting.
- **External ids, feature keys, manifest keys are forever**: Gladys keys the
  devices, their history, the scenes and the dashboards on them.
- **Created devices** are rebuilt from their params (`stop_code`, `routes`,
  `station_id`): never rename those params.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json` / the manifest, nor the `docker_image` tag, by hand.
- **Changelog**: every user-visible change adds a line under
  `## [Unreleased]` in `CHANGELOG.md`.
- **Never commit a personal stop**: use network landmarks in examples and
  tests (Gare du Palais: stops 1022 and 5601, àVélo station 3; the Gare du
  Palais as the house).
- Tests never touch the network: `test/helpers/stubFetch.js` routes `fetch`.
  They do read the real `gtfs/` table: a regeneration that drops a landmark
  shows there.

## Roadmap ideas

- Real time, if the RTC ever opens it.
- STLévis (Lévis), across the river, with the same code.
- Ask the Transitous team for an explicit OK before the integration gets many
  users (their policy asks to be contacted for heavy use).
- Screenshots in the user documentation.
