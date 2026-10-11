// -----------------------------------------------------------------------------
// Configuration: defaults, type coercion, watch-list mini-syntax.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  departuresSource,
  linesEnabled,
  estimatedDailyRequests,
  gladysPollFrequency,
  hasApiKey,
  normalizeConfig,
  parseSimpleEntry,
  parseStopEntry,
  stopPlatformId,
} from '../src/config.js';

test('an empty configuration gets the defaults, Transitous and no line', () => {
  const config = normalizeConfig();
  assert.equal(config.departures_poll_frequency, DEFAULT_CONFIG.departures_poll_frequency);
  assert.equal(config.language, 'fr');
  assert.deepEqual(config.watched, { stops: [], bikeStations: [], lines: false });
  // No real-time feed in the open: a key changes nothing.
  assert.equal(hasApiKey(normalizeConfig({ api_key: 'k' })), false);
  assert.equal(departuresSource(normalizeConfig({ api_key: 'k' })), 'schedule');
  assert.equal(linesEnabled(config), false);
  assert.equal(config.nearby_stops, 3);
  assert.equal(config.nearby_bike_stations, 2);
});

test('the stop syntax: code, route filter, custom name', () => {
  assert.deepEqual(parseStopEntry('1022'), { id: '1022', routes: [], name: null });
  assert.deepEqual(parseStopEntry(' 1022 @ 800 | 11g : Bus du travail '), {
    id: '1022',
    routes: ['800', '11G'],
    name: 'Bus du travail',
  });
  // The name may hold an '@': the name is cut first.
  assert.deepEqual(parseStopEntry('1022:Moi@maison'), {
    id: '1022',
    routes: [],
    name: 'Moi@maison',
  });
  assert.equal(parseStopEntry('@24'), null);
  assert.deepEqual(parseSimpleEntry('3:Maison'), { id: '3', name: 'Maison' });
  assert.equal(parseSimpleEntry(' :x'), null);
});

test('lists accept commas, semicolons and new lines, and drop duplicates', () => {
  const config = normalizeConfig({
    stops: '1022;5601@800\n1022, 5601@801',
    bike_stations: '3, 3:Encore, 30',
  });
  assert.deepEqual(config.watched.stops.map(stopPlatformId), ['1022', '5601@800', '5601@801']);
  assert.deepEqual(
    config.watched.bikeStations.map((station) => station.id),
    ['3', '30'],
  );
});

test('numbers, booleans and the language are coerced and bounded', () => {
  const config = normalizeConfig({
    departures_poll_frequency: '5',
    lines_poll_frequency: 'abc',
    bike_poll_frequency: 99999,
    max_departures: '9',
    watch_lines: 'false',
    language: 'de',
    api_key: '  key  ',
  });
  assert.equal(config.departures_poll_frequency, 30);
  assert.equal(config.lines_poll_frequency, DEFAULT_CONFIG.lines_poll_frequency);
  assert.equal(config.bike_poll_frequency, 3600);
  assert.equal(config.max_departures, 5);
  assert.equal(config.watched.lines, false);
  assert.equal(config.language, 'fr');
  assert.equal(config.api_key, 'key');
});

test('poll frequencies map onto the values the Gladys scheduler accepts', () => {
  assert.equal(gladysPollFrequency(30), 30_000);
  assert.equal(gladysPollFrequency(60), 60_000);
  assert.equal(gladysPollFrequency(300), 60_000);
});

test('nothing is read from the operator: no request to count', () => {
  assert.equal(estimatedDailyRequests(normalizeConfig({ api_key: 'k', stops: '1, 2, 3' })), 0);
});

test('Transitous is the only source, and cannot be turned off', () => {
  assert.equal(departuresSource(normalizeConfig({ schedule_without_key: false })), 'schedule');
});

test('the suggestion counts are bounded, 0 turning them off', () => {
  const config = normalizeConfig({ nearby_stops: '0', nearby_bike_stations: 99 });
  assert.equal(config.nearby_stops, 0);
  assert.equal(config.nearby_bike_stations, 8);
  assert.equal(normalizeConfig({ nearby_stops: 'x' }).nearby_stops, 3);
});
