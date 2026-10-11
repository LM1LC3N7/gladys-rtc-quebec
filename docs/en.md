# RTC Québec

The **next departures** of the Réseau de transport de la Capitale (RTC) buses
and the **àVélo bikes** near your home, in Gladys.

This integration is not affiliated with the RTC nor with the City of Québec.

## Get started in 3 steps

No technical knowledge is needed, and no account: there is **nothing to
create, no key**.

1. **Check the address of your house in Gladys**: _Settings → Houses_. The
   house must have a position on the map. The integration uses it to find the
   stops near you. The position stays in your Gladys.
2. **Install the integration** from the integration catalog, and accept the
   access to the house location. Open its configuration page and press
   **Save**, without filling anything in.
3. Open the **Discover** tab of the integration. The 3 stops and 2 àVélo
   stations closest to your home are offered there, with their name and the
   direction of their routes, e.g. "RTC – Saint-Paul / A.-Martin (1 → Station
   Belvédère (Nord))". Press **Add** on each one you want.

That's it. You now get the **next departures** at each stop, and the bikes and
free docks of each àVélo station.

The message at the top of the configuration page always tells you what to do
next. For example: "Ready: 3 stops and 2 àVélo stations to add. Open the
Discover tab…".

Device names start with **RTC –** or **àVélo –**, so they are easy to tell
apart in the device list of Gladys. You can rename them freely in Gladys.

### Showing the departures on the dashboard

1. Open the dashboard, then press **Edit**.
2. Add a widget and choose **RTC departures**.
3. Choose the stop, then save.

The **àVélo station** widget is added the same way.

The departures are **scheduled times**, marked with a **~**: "~12 min" means
"scheduled in 12 minutes".

## What about real time?

The RTC does not publish its real time as open data: it stays in its Nomade
app. The departures therefore come from the RTC **timetable**, through
Transitous, a free community service, read every 2 minutes. Should the RTC
open its real time one day, the integration is ready to read it.

## Watching other stops (work, school…)

For a stop far from home:

1. At the bottom of the configuration page, press **Find a stop**. Type a
   street or the stop number, e.g. "Gare du Palais" or "Grande Allée Cartier".
2. The answer lists the stops with their number and the direction of their
   routes, e.g. `1022 — Saint-Paul / A.-Martin (1 → Station Belvédère (Nord))`.
3. Copy the number (`1022`) in **Stops**, save, then add the stop in the
   **Discover** tab.

The number is the one written on every RTC stop sign.

For àVélo stations, the **Find an àVélo station** button works the same way.

### Going further

The **Stops** field accepts several numbers separated by commas, a route
filter after `@` and a name after `:`.

| Entry                 | Meaning                              |
| --------------------- | ------------------------------------ |
| `1022`                | every route calling at stop 1022     |
| `5601@18`             | route 18 only                        |
| `1022@1\|6`           | routes 1 and 6                       |
| `5601@18:Bus to work` | route 18, displayed as "Bus to work" |

## What each device holds

**Stop:**

- **Next departure**, **Departure 2**…: the minutes to wait. 999 means no
  departure is scheduled.
- **Next departure route**…: the route ("800", "11G").
- **Next departures**: a summary, e.g. `1 ~3 min · 6 ~11 min`.

**àVélo station:** the bikes (e-bikes included), the e-bikes, the free docks
and the state of the station.

A station that leaves the àVélo network (removed for the winter) shows 0
bikes, 0 docks and the state "Removed from the àVélo network (seasonal?)",
with an orange dot on the device. The "Out of service" trigger fires once,
then "Back in service" when it returns. There is nothing to do.

## Scenes

**Triggers:**

- **Departure approaching**: a departure gets under 1, 2, 3, 5, 10 or 15
  minutes. Example: "when the 800 is 5 minutes away, turn the hall light on".
- **àVélo station changed**: the station runs out of bikes or docks, or gets
  some back.

**Action:** **Read the next departures**: e.g. a message every morning "Your
800 comes in {{minutes}} minutes".

## Troubleshooting

| Message or symptom                                | What to do                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "set the address of your house"                   | _Settings → Houses_: place the house on the map, then save the configuration of the integration again. |
| "Gladys did not share the location of your house" | Reinstall the integration and accept the location access, or type stop numbers.                        |
| Nothing in the Discover tab                       | Read the message of the configuration page: it says what is missing.                                   |
| "Stop … is not in the RTC stop list"              | Check the number on the sign. A brand new stop comes with the next version of the integration.         |
| Station "Removed from the àVélo network"          | The station left the network, often for the winter: it will come back by itself.                       |
| A stop stays at 999                               | No departure scheduled (at night), or a route filter matching no route of the stop.                    |

## Privacy, data and licences

- The house location is only used to look the nearby stops up, in the stop
  list shipped with the integration: it is sent nowhere.
- Stop list: the RTC GTFS, shipped with the integration and updated with
  every version. "Application, produit ou service, intégrant les Informations
  publiques du Réseau de transport de la Capitale, mises à jour le
  2026-10-11." ([terms](https://www.rtcquebec.ca/donnees-ouvertes))
- Departures: [Transitous](https://transitous.org/sources/), a free community
  service, from the RTC data.
- Bikes: public GBFS feed of àVélo.
- Integration code: Apache 2.0 licence.
