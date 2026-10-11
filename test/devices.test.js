// -----------------------------------------------------------------------------
// Devices: discovery payloads, polling, publication, manifest actions.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';
import {
  bikeRoutes,
  DISCOVERY,
  INFORMATION,
  STATUS,
  stopTimesPayload,
  VEHICLE_TYPES,
} from './helpers/fixtures.js';
import { GLADYS_POLL_FREQUENCIES_MS, normalizeConfig } from '../src/config.js';
import {
  ACTIONS,
  buildBlueprints,
  buildDiscoveredDevices,
  findSelectedBlueprint,
  DeviceSelectionError,
  pollDevice,
  refreshDeviceNow,
} from '../src/devices/index.js';
import { NO_DEPARTURE_MINUTES } from '../src/devices/stop.js';
import { clearPollSchedule } from '../src/devices/pollSchedule.js';
import { clearStateCache } from '../src/devices/stateCache.js';
import { clearPublishReports } from '../src/devices/publish.js';
import { clearReadings } from '../src/devices/readings.js';
import { clearSceneMemory } from '../src/scenes/triggers.js';
import { clearBikeCache, GBFS_URL } from '../src/api/bikes.js';
import { clearTransitousCache } from '../src/api/transitous.js';
import { clearSuggestions } from '../src/devices/suggestions.js';
import { ABSENT_POLL_SECONDS, clearAbsentStations } from '../src/devices/bikeStation.js';

const config = normalizeConfig({
  stops: '1022, 5601@800:Bus du travail',
  bike_stations: '3',
  max_departures: 2,
});

function routes(extra = {}) {
  return {
    '/v5/stoptimes': stopTimesPayload(Date.now(), [{ minutes: 3 }]),
    ...bikeRoutes(),
    ...extra,
  };
}

beforeEach(() => {
  clearPollSchedule();
  clearStateCache();
  clearPublishReports();
  clearReadings();
  clearSceneMemory();
  clearBikeCache();
  clearTransitousCache();
  clearSuggestions();
  clearAbsentStations();
});
afterEach(() => restoreFetch());

test('one device per watched stop and station, and no line device in Québec', () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(
    gladys,
    normalizeConfig({ ...config, api_key: 'k', watch_lines: true }),
  );
  assert.deepEqual(
    devices.map((device) => device.name),
    ['RTC – Saint-Paul / A.-Martin', 'Bus du travail', 'àVélo – station 3'],
  );
  assert.deepEqual(
    devices.map((device) => device.external_id),
    ['transit-stop:1022', 'transit-stop:5601@800', 'bike-station:3'],
  );
});

test('every discovery payload is one the core accepts', () => {
  const gladys = createFakeGladys();
  for (const device of buildDiscoveredDevices(gladys, config)) {
    assert.ok(GLADYS_POLL_FREQUENCIES_MS.includes(device.poll_frequency), device.name);
    assert.equal(device.should_poll, true, `${device.name} must be scheduled by the core`);
    const ids = new Set();
    for (const feature of device.features) {
      // t_device_feature.min / max are NOT NULL in the core.
      assert.equal(typeof feature.min, 'number', `${feature.name} needs a min`);
      assert.equal(typeof feature.max, 'number', `${feature.name} needs a max`);
      assert.equal(feature.read_only, true);
      assert.ok(!ids.has(feature.external_id), `duplicate feature ${feature.external_id}`);
      ids.add(feature.external_id);
    }
  }
  // 2 departures x (minutes + route) + summary.
  assert.equal(buildDiscoveredDevices(gladys, config)[0].features.length, 5);
});

test('feature names follow the configured language, French by default', () => {
  const gladys = createFakeGladys();
  const [arret] = buildDiscoveredDevices(gladys, config);
  assert.equal(arret.features[0].name, 'Prochain passage');
  const [stop] = buildDiscoveredDevices(gladys, normalizeConfig({ ...config, language: 'en' }));
  assert.equal(stop.features[0].name, 'Next departure');
});

test('polling a stop publishes the timetable, every 2 minutes at most', async () => {
  const calls = stubFetch(routes());
  const gladys = createFakeGladys();
  const [stop] = buildDiscoveredDevices(gladys, config);
  assert.equal(stop.poll_frequency, 60_000);
  assert.equal(buildBlueprints(gladys, config)[0].pollIntervalMs(config), 120_000);

  await pollDevice(gladys, { external_id: 'transit-stop:1022' }, config);
  const byFeature = Object.fromEntries(
    gladys.published.map((state) => [state.featureExternalId, state.state ?? state.text]),
  );
  assert.ok([2, 3].includes(byFeature['transit-stop:1022:departure_1']));
  assert.equal(byFeature['transit-stop:1022:departure_1_route'], '1');
  assert.equal(byFeature['transit-stop:1022:departure_2'], NO_DEPARTURE_MINUTES);
  assert.match(byFeature['transit-stop:1022:departures'], /^1 ~[23] min$/);
  assert.ok(calls.every((call) => call.url.includes('transitous.org')));
});

test('polling a bike station publishes its counts and status', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  await pollDevice(gladys, { external_id: 'bike-station:3' }, config);
  const byFeature = Object.fromEntries(
    gladys.published.map((state) => [state.featureExternalId, state.state ?? state.text]),
  );
  assert.equal(byFeature['bike-station:3:bikes'], 8);
  assert.equal(byFeature['bike-station:3:electric_bikes'], 2);
  assert.equal(byFeature['bike-station:3:docks'], 12);
  assert.equal(byFeature['bike-station:3:status'], 'retour impossible');
});

test('the ticks inside the refresh interval do not read again', async () => {
  const calls = stubFetch(routes());
  const gladys = createFakeGladys();
  await pollDevice(gladys, { external_id: 'transit-stop:1022' }, config);
  await pollDevice(gladys, { external_id: 'transit-stop:1022' }, config);
  assert.equal(calls.length, 1);

  // A device just created is read right away, whole.
  const before = gladys.published.length;
  await refreshDeviceNow(gladys, { external_id: 'transit-stop:1022' }, config);
  assert.equal(calls.length, 2);
  assert.equal(gladys.published.length - before, 5);
});

test('a device removed from the configuration is ignored', async () => {
  const calls = stubFetch({});
  await pollDevice(createFakeGladys(), { external_id: 'transit-stop:00000' }, config);
  assert.equal(calls.length, 0);
});

test('a stop code missing from the stop table says so', async () => {
  const unknown = normalizeConfig({ stops: '99999' });
  const [blueprint] = buildBlueprints(createFakeGladys(), unknown);
  await assert.rejects(blueprint.read(unknown), (err) =>
    /n’est pas dans la liste des arrêts RTC/.test(err.userMessage.fr),
  );
});

test('a widget pointing at a device of another kind gets an explanation', () => {
  const gladys = createFakeGladys();
  assert.throws(
    () => findSelectedBlueprint(gladys, 'bike-station:3', config, 'transit-stop'),
    (err) => err instanceof DeviceSelectionError && /àVélo/.test(err.userMessage.en),
  );
});

test('no key test without a real-time feed; the searches are there', () => {
  assert.deepEqual(Object.keys(ACTIONS), ['search_stops', 'search_bike_stations']);
});

test('search_bike_stations lists the ids to paste', async () => {
  stubFetch(routes());
  const message = await ACTIONS.search_bike_stations(createFakeGladys(), {
    fields: { query: 'gare' },
    config,
  });
  assert.match(message.fr, /3 — Gare du Palais \(20\)/);
});

test('search_stops lists the codes with the directions of their routes', async () => {
  stubFetch(routes());
  const message = await ACTIONS.search_stops(createFakeGladys(), {
    fields: { query: '1022' },
    config,
  });
  assert.match(message.fr, /^Collez un code dans « Arrêts »/);
  assert.match(message.fr, /1022 — Saint-Paul \/ A\.-Martin \(1 → Station Belvédère \(Nord\)\)/);
});

test('a created device keeps refreshing once it is neither typed nor suggested', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  const empty = normalizeConfig({});
  gladys.devices = [
    {
      external_id: 'transit-stop:1022@1',
      name: 'Mon bus',
      params: [
        { name: 'stop_code', value: '1022' },
        { name: 'routes', value: '1' },
      ],
    },
    { external_id: 'bike-station:3', name: 'àVélo', params: [{ name: 'station_id', value: '3' }] },
  ];
  assert.deepEqual(
    buildDiscoveredDevices(gladys, empty).map((device) => device.external_id),
    ['transit-stop:1022@1', 'bike-station:3'],
  );
  await pollDevice(gladys, { external_id: 'transit-stop:1022@1' }, empty);
  assert.ok(gladys.published.some((state) => state.featureExternalId.endsWith(':departure_1')));
});

// --- Stations removed from the feed ------------------------------------------

/** The bike routes, with station 3 present or removed from both files. */
function bikesWith({ present }) {
  const keep = (stations) => stations.filter((station) => present || station.station_id !== '3');
  return {
    [GBFS_URL]: DISCOVERY,
    '/station_information.json': { data: { stations: keep(INFORMATION.data.stations) } },
    '/station_status.json': { data: { stations: keep(STATUS.data.stations) } },
    '/vehicle_types.json': VEHICLE_TYPES,
  };
}

test('a station removed for the winter shows as removed, flagged, read every 15 minutes', async () => {
  const gladys = createFakeGladys();
  const device = { external_id: 'bike-station:3' };
  const bikeConfig = normalizeConfig({ bike_stations: '3' });
  const [blueprint] = buildBlueprints(gladys, bikeConfig);

  stubFetch(bikesWith({ present: true }));
  await pollDevice(gladys, device, bikeConfig);

  restoreFetch();
  clearBikeCache();
  clearPollSchedule();
  stubFetch(bikesWith({ present: false }));
  await pollDevice(gladys, device, bikeConfig);

  const latest = (key) =>
    gladys.published.filter((state) => state.featureExternalId === `bike-station:3:${key}`).at(-1);
  assert.equal(latest('bikes').state, 0);
  assert.equal(latest('status').text, 'Retirée du réseau àVélo (saisonnier ?)');
  assert.equal(gladys.transports.at(-1).degraded, true);
  assert.equal(blueprint.pollIntervalMs(bikeConfig), ABSENT_POLL_SECONDS * 1000);
  assert.deepEqual(
    gladys.sceneEvents.map((event) => event.data.event),
    ['out_of_service'],
  );

  restoreFetch();
  clearBikeCache();
  clearPollSchedule();
  stubFetch(bikesWith({ present: true }));
  await pollDevice(gladys, device, bikeConfig);
  assert.deepEqual(
    gladys.sceneEvents.map((event) => event.data.event),
    ['out_of_service', 'back_in_service'],
  );
  assert.equal(blueprint.pollIntervalMs(bikeConfig), bikeConfig.bike_poll_frequency * 1000);
});
