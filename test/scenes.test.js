// -----------------------------------------------------------------------------
// Scene triggers (computed between two polls) and scene actions.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';
import { stopTimesPayload } from './helpers/fixtures.js';
import { normalizeConfig } from '../src/config.js';
import { pollDevice } from '../src/devices/index.js';
import { clearPollSchedule } from '../src/devices/pollSchedule.js';
import { clearStateCache } from '../src/devices/stateCache.js';
import { clearReadings } from '../src/devices/readings.js';
import {
  bikeStationEvents,
  clearSceneMemory,
  departureCrossings,
  lineEvents,
  SCENE_TRIGGERS,
} from '../src/scenes/triggers.js';
import { SCENE_ACTIONS } from '../src/scenes/actions.js';
import { clearTransitousCache } from '../src/api/transitous.js';
import { LINE_STATUS } from '../src/api/lines.js';

const config = normalizeConfig({ stops: '1022', language: 'fr' });

beforeEach(() => {
  clearPollSchedule();
  clearStateCache();
  clearReadings();
  clearSceneMemory();
  clearTransitousCache();
});
afterEach(() => restoreFetch());

const bus = (tripId, minutes, route = '1') => ({ tripId, route, minutes });

test('a bus is followed by its trip: every threshold it crosses fires once', () => {
  assert.deepEqual(
    departureCrossings([bus('A', 11)], [bus('A', 4)]).map((crossing) => crossing.threshold),
    [5, 10],
  );
  // The next bus taking the place of the one that left is not a crossing.
  assert.deepEqual(departureCrossings([bus('A', 1)], [bus('B', 9)]), []);
  // A bus appearing on the board did not approach.
  assert.deepEqual(departureCrossings([], [bus('A', 2)]), []);
});

test('line events: one per line whose status changed, unknown is a hole', () => {
  const lines = (statuses) =>
    Object.entries(statuses).map(([id, status]) => ({
      id,
      status,
      message: '',
      name: { en: id, fr: id },
    }));
  const { NORMAL, DISRUPTED, NOTICE, UNKNOWN } = LINE_STATUS;
  assert.deepEqual(
    lineEvents(
      { lines: lines({ 1: NORMAL, 2: DISRUPTED, 4: NORMAL, 5: DISRUPTED }) },
      { lines: lines({ 1: DISRUPTED, 2: NORMAL, 4: NOTICE, 5: UNKNOWN }) },
    ).map(({ line, event }) => [line.id, event]),
    [
      ['1', 'disrupted'],
      ['2', 'restored'],
      ['4', 'notice'],
    ],
  );
});

test('a station leaving and coming back to the feed is one event each way', () => {
  const live = { bikes: 3, docks: 4, installed: true };
  const removed = { bikes: 0, docks: 0, installed: false, absent: true };
  assert.deepEqual(bikeStationEvents(live, removed), ['out_of_service']);
  assert.deepEqual(bikeStationEvents(removed, removed), []);
  assert.deepEqual(bikeStationEvents(removed, live), ['back_in_service']);
  // Already out of service before it was removed: nothing new to announce.
  assert.deepEqual(bikeStationEvents({ ...live, installed: false }, removed), []);
});

test('bike station events', () => {
  assert.deepEqual(bikeStationEvents({ bikes: 2, docks: 0 }, { bikes: 0, docks: 2 }), [
    'no_bike',
    'docks_back',
  ]);
  assert.deepEqual(bikeStationEvents({ installed: true }, { installed: false }), [
    'out_of_service',
  ]);
  assert.deepEqual(bikeStationEvents({}, { bikes: 0 }), []);
});

test('the departure trigger follows the trips of the timetable', async () => {
  const gladys = createFakeGladys();
  const at = (minutes) => ({ '/v5/stoptimes': stopTimesPayload(Date.now(), [{ minutes }]) });
  stubFetch(at(7.5));
  await pollDevice(gladys, { external_id: 'transit-stop:1022' }, config);
  restoreFetch();
  stubFetch(at(4.5));
  clearPollSchedule();
  clearTransitousCache();
  await pollDevice(gladys, { external_id: 'transit-stop:1022' }, config);

  assert.deepEqual(gladys.sceneEvents, [
    {
      key: SCENE_TRIGGERS.DEPARTURE_APPROACHING,
      data: {
        stop: 'transit-stop:1022',
        stop_name: 'RTC – Saint-Paul / A.-Martin',
        route: '1',
        threshold: '5',
        minutes: 4,
      },
    },
  ]);
});

test('scene action get_next_departures reads now and filters by route', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(Date.now(), [
      { minutes: 1.5, routeId: '1-6', shortName: '6', headsign: "Terminus Place-D'Youville" },
      { minutes: 6.5 },
    ]),
  });
  const outputs = await SCENE_ACTIONS.get_next_departures(createFakeGladys(), {
    // "001" reads as the 1.
    fields: { stop: 'transit-stop:1022', route: '001' },
    config,
  });
  assert.deepEqual(outputs, {
    route: '1',
    minutes: 6,
    following_minutes: null,
    summary: '1 ~6 min',
    count: 1,
  });
});

test('no line status in Québec: the action is not registered', () => {
  assert.equal(SCENE_ACTIONS.get_line_status, undefined);
});
