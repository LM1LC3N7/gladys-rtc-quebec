# Gladys RTC Québec

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings Québec City public transit into your smart home:

- **next RTC bus departures** (Métrobus, eXpress, regular routes), from the
  RTC timetable through the free Transitous service;
- **àVélo stations**: bikes, e-bikes and free docks (open GBFS feed).

**Nothing to create, no key:** the integration reads the location of the
house from Gladys and offers the closest stops and àVélo stations in the
Discover tab, named the way people know them ("RTC – Saint-Paul / A.-Martin (1
→ Station Belvédère (Nord))").

Unofficial: not affiliated with the Réseau de transport de la Capitale nor
with the City of Québec.

User documentation: [français](docs/fr.md) · [English](docs/en.md).

## What you get in Gladys

| Kind                  | Content                                                         |
| --------------------- | --------------------------------------------------------------- |
| Devices               | one per stop (minutes to wait, route, summary), one per station |
| Dashboard widgets     | departures board, àVélo station                                 |
| Scene triggers        | departure approaching (1–15 min), àVélo station empty / full    |
| Scene action          | read the next departures of a stop                              |
| Configuration buttons | find a stop or an àVélo station by name                         |

Requires Gladys **5.1.0** or later.

No real time: the RTC keeps it in its Nomade app and publishes only its
timetable as open data. The shared code reads a GTFS-Realtime feed the day one
opens (`NETWORK.realtime` in `src/network.js`).

## How it works

- **The stop table** (`gtfs/stops.json`, `gtfs/routes.json`) is generated from
  the RTC static GTFS by `npm run update-stops` and ships with the image. It
  turns the number on the sign into the GTFS stop id, names each stop by its
  corner ("Saint-Paul / A.-Martin"), and answers the stop search and the "near
  my home" suggestions without any request.
- **Departures**: Transitous, read every two minutes at most.
- **àVélo**: the GBFS 2.3 feed of the PBSC system (the one of BIXI too).

## Development

```bash
npm install
npm test               # node --test, no network access
npm run lint           # ESLint
npm run format:check   # Prettier, as the CI runs it
npm run update-stops   # regenerate gtfs/ from the RTC static GTFS
npx github:GladysAssistant/integration-store .   # store admission checks
```

The project follows the official
[integration template](https://github.com/GladysAssistant/integration-template-js)
and shares its code with
[gladys-stm](https://github.com/LM1LC3N7/gladys-stm),
[gladys-translink](https://github.com/LM1LC3N7/gladys-translink) and
[gladys-octranspo](https://github.com/LM1LC3N7/gladys-octranspo): the network
lives in `src/network.js`. See [CLAUDE.md](CLAUDE.md) for the architecture
and the conventions.

### Publishing a version

1. In GitHub: **Actions → Release → Run workflow**. Choose **minor** for the
   first release (0.0.0 → 0.1.0), then patch / minor / major.
2. The first time only: make the GHCR package **public**
   (`github.com/LM1LC3N7/gladys-rtc-quebec/pkgs/container/gladys-rtc-quebec` →
   Package settings → Change visibility).
3. Add the topic `gladys-assistant-integration` to the repository: the store
   indexer picks the integration up within the hour.

## Data and licences

- "Application, produit ou service, intégrant les Informations publiques du
  Réseau de transport de la Capitale, mises à jour le 2026-10-11."
  ([terms](https://www.rtcquebec.ca/donnees-ouvertes)) Update the date with
  every `npm run update-stops`.
- Departures: [Transitous](https://transitous.org/sources/) (free community
  service; the integration sends a User-Agent naming it, caches every
  description and never reads departures more than every two minutes).
- àVélo data: public GBFS feed of àVélo.
- Code: Apache License 2.0. Parts of `src/devices/` are adapted from
  [prohand/gladys-transport-commun-lyonnais](https://github.com/prohand/gladys-transport-commun-lyonnais)
  (Apache-2.0), see [NOTICE](NOTICE).
