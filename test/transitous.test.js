// -----------------------------------------------------------------------------
// Transitous client: departures of a stop code, route labels, descriptions.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearTransitousCache,
  describeStop,
  formatRoutes,
  gtfsId,
  knownStop,
  scheduledDepartures,
  stopTimes,
  tidyHeadsign,
  TransitousError,
} from '../src/api/transitous.js';
import { distanceMeters } from '../src/api/stops.js';
import { stopTimesPayload } from './helpers/fixtures.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';

const HOME = { lat: 46.817, lon: -71.212 };
const NOW = Date.UTC(2026, 9, 11, 16, 0, 0);

beforeEach(() => clearTransitousCache());
afterEach(() => restoreFetch());

test('Transitous ids give back the GTFS ids', () => {
  assert.equal(gtfsId('ca-qc-RTC_1-1022'), '1-1022');
  assert.equal(gtfsId('20261011_06:12_ca-qc-RTC_1-123456'), '1-123456');
  assert.equal(gtfsId(undefined), '');
});

test('a stop code is asked by its GTFS id, with a User-Agent', async () => {
  const calls = stubFetch({ '/v5/stoptimes': stopTimesPayload(NOW, [{ minutes: 3 }]) });
  await stopTimes('1022');
  assert.match(calls[0].url, /stopId=ca-qc-RTC_1-1022&n=10/);
  assert.match(calls[0].headers['User-Agent'], /^gladys-rtc-quebec\/.*github\.com/);
  await assert.rejects(stopTimes('00000'), TransitousError);
});

test('the departures: route labels from the table, other bays and termini dropped', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: 3 },
      {
        minutes: 7,
        routeId: '1-18',
        shortName: '18',
        headsign: 'Université Laval (Ouest)',
        delayMinutes: 2,
      },
      // Transitous answers for a group of stops: the other side of the
      // street is another sign.
      { minutes: 8, stopId: '1-1064' },
      { minutes: 9, cancelled: true },
      { minutes: 10, pickupType: 'NOT_ALLOWED' },
      // A route the table does not know: the short name, without its zeros.
      { minutes: 11, routeId: 'new', shortName: '0R5', headsign: 'Hastings', realTime: true },
    ]),
  });
  const departures = await stopTimes('1022');
  assert.deepEqual(
    departures.map(({ route, headsign, delaySeconds, realtime }) => [
      route,
      headsign,
      delaySeconds,
      realtime,
    ]),
    [
      ['1', 'Station Belvédère (Nord)', 0, false],
      ['18', 'Université Laval (Ouest)', 120, false],
      ['R5', 'Hastings', 0, true],
    ],
  );
});

test('headsigns lose the route they repeat', () => {
  assert.equal(tidyHeadsign('3 Main/To Marine Dr Station', '3'), 'Main/To Marine Dr Station');
  assert.equal(tidyHeadsign('Canada Line To YVR-Airport', 'Canada Line'), 'YVR-Airport');
  assert.equal(tidyHeadsign('UBC', '99'), 'UBC');
  assert.equal(tidyHeadsign('99', '99'), '99');
  assert.equal(tidyHeadsign('Hospital ~ Hôpital', '45'), 'Hospital / Hôpital');
});

test('scheduled departures have the shape of the real-time board', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: -5 },
      { minutes: 4, routeId: '1-18', shortName: '18', headsign: 'Université Laval (Ouest)' },
      { minutes: 2 },
    ]),
  });
  const board = await scheduledDepartures({ id: '1022', routes: [] }, { now: NOW });
  assert.deepEqual(
    board.map(({ route, minutes, realtime, headsign }) => [route, minutes, realtime, headsign]),
    [
      ['1', 2, false, 'Station Belvédère (Nord)'],
      ['18', 4, false, 'Université Laval (Ouest)'],
    ],
  );
  const filtered = await scheduledDepartures({ id: '1022', routes: ['18'] }, { now: NOW });
  assert.deepEqual(
    filtered.map((departure) => departure.route),
    ['18'],
  );
});

test('a stop description is cached for a day, and survives a failed refresh', async () => {
  const calls = stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: 1, routeId: '1-18', shortName: '18', headsign: 'Université Laval (Ouest)' },
      { minutes: 2 },
      { minutes: 3 },
    ]),
  });
  const description = await describeStop('1022', { now: NOW });
  assert.equal(
    formatRoutes(description),
    '1 → Station Belvédère (Nord), 18 → Université Laval (Ouest)',
  );
  assert.equal(description.name, 'Saint-Paul / A.-Martin');
  assert.deepEqual(description.trips.get('T0'), {
    route: '18',
    headsign: 'Université Laval (Ouest)',
  });
  await describeStop('1022', { now: NOW + 3_600_000 });
  assert.equal(calls.length, 1);
  assert.equal(knownStop('1022'), description);

  restoreFetch();
  stubFetch({ '/v5/stoptimes': { status: 503, body: 'down' } });
  const stale = await describeStop('1022', { now: NOW + 2 * 86_400_000 });
  assert.equal(stale, description);
  assert.equal(await describeStop('00000', { now: NOW }), null);
});

test('a route serving both directions lists both', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: 1, headsign: 'West' },
      { minutes: 2, headsign: 'East' },
      { minutes: 3, headsign: 'West' },
    ]),
  });
  assert.equal(formatRoutes(await describeStop('1022', { now: NOW })), '1 → West/East');
});

test('distances', () => {
  assert.equal(distanceMeters(HOME, HOME), 0);
  const oneKmNorth = { lat: HOME.lat + 1 / 111.2, lon: HOME.lon };
  assert.ok(Math.abs(distanceMeters(HOME, oneKmNorth) - 1000) < 5);
});
