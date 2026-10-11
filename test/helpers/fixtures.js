// -----------------------------------------------------------------------------
// Payloads shared by the suites. The GBFS ones follow the live àVélo feed
// (GBFS 2.3 of the PBSC system, true booleans, e-bikes counted by vehicle
// type); the Transitous ones follow api.transitous.org (trimmed to the fields
// the integration reads).
//
// Stops are network landmarks of the stop table (gtfs/stops.json):
//   1022  Saint-Paul / A.-Martin, by the Gare du Palais   (stop_id 1-1022)
//   5601  de la Gare du Palais / A.-Martin                 (stop_id 1-5601)
// Routes: route_id 1-1 is the 1, 1-18 the 18, 1-800 the Métrobus 800.
// -----------------------------------------------------------------------------

import { GBFS_URL } from '../../src/api/bikes.js';
import { NETWORK } from '../../src/network.js';

const feeds = (lang) => [
  { name: 'station_information', url: `https://gbfs.example/${lang}/station_information.json` },
  { name: 'station_status', url: `https://gbfs.example/${lang}/station_status.json` },
  { name: 'vehicle_types', url: `https://gbfs.example/${lang}/vehicle_types.json` },
];

export const DISCOVERY = {
  ttl: 60,
  version: '2.2',
  data: { en: { feeds: feeds('en') }, fr: { feeds: feeds('fr') } },
};

export const INFORMATION = {
  data: {
    stations: [
      // At the Gare du Palais, the house of the fake Gladys.
      { station_id: '3', name: 'Gare du Palais', capacity: 20, lat: 46.8175, lon: -71.2129 },
      // 600 m away: within the 1 km radius.
      { station_id: '30', name: 'Bassin Louise', capacity: 18, lat: 46.8199, lon: -71.2063 },
      // Université Laval, 6 km away: beyond the radius.
      { station_id: '200', name: 'Université Laval', capacity: 25, lat: 46.7817, lon: -71.2747 },
    ],
  },
};

export const STATUS = {
  data: {
    stations: [
      {
        station_id: '3',
        num_bikes_available: 8,
        num_docks_available: 12,
        is_installed: true,
        is_renting: true,
        is_returning: false,
        last_reported: 1791644363,
        vehicle_types_available: [
          { vehicle_type_id: '1', count: 6 },
          { vehicle_type_id: '2', count: 2 },
        ],
      },
      { station_id: '30', num_bikes_available: 0, num_docks_available: 18, is_installed: false },
      { station_id: '200', num_bikes_available: 4, num_docks_available: 21, is_installed: true },
    ],
  },
};

export const VEHICLE_TYPES = {
  data: {
    vehicle_types: [
      { vehicle_type_id: '1', form_factor: 'bicycle', propulsion_type: 'human' },
      { vehicle_type_id: '2', form_factor: 'bicycle', propulsion_type: 'electric_assist' },
    ],
  },
};

export function bikeRoutes() {
  return {
    [GBFS_URL]: DISCOVERY,
    '/station_information.json': INFORMATION,
    '/station_status.json': STATUS,
    '/vehicle_types.json': VEHICLE_TYPES,
  };
}

// --- Transitous ---------------------------------------------------------------

/**
 * /v5/stoptimes for one stop: departures `minutes` from `now` (ms). The
 * default route is the 1, leaving from Saint-Paul / A.-Martin (stop_id 1-1022).
 */
export function stopTimesPayload(now, entries) {
  const iso = (ms) => new Date(ms).toISOString();
  const prefix = NETWORK.transitousPrefix;
  return {
    stopTimes: entries.map(
      (
        {
          minutes,
          routeId = '1-1',
          shortName = '1',
          headsign = 'Station Belvédère (Nord)',
          stopId = '1-1022',
          delayMinutes = 0,
          cancelled = false,
          realTime = false,
          pickupType = 'NORMAL',
        },
        index,
      ) => ({
        place: {
          name: 'Saint-Paul/1022',
          stopId: `${prefix}${stopId}`,
          departure: iso(now + (minutes + delayMinutes) * 60_000),
          scheduledDeparture: iso(now + minutes * 60_000),
          pickupType,
        },
        realTime,
        headsign,
        tripId: `20261011_06:12_${prefix}T${index}`,
        routeId: `${prefix}${routeId}`,
        routeShortName: shortName,
        cancelled,
        tripCancelled: false,
      }),
    ),
  };
}
