// -----------------------------------------------------------------------------
// Dashboard widgets: every content must pass the SDK's own validator (the
// vocabulary and the budget the core enforces), and no failure may reach the
// dashboard as an exception.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';
import { bikeRoutes, stopTimesPayload } from './helpers/fixtures.js';
import { normalizeConfig } from '../src/config.js';
import { clearReadings } from '../src/devices/readings.js';
import { absentStation, clearBikeCache } from '../src/api/bikes.js';
import { bikeStationContent, departuresContent } from '../src/widgets/index.js';
import { truncate, WIDGETS } from '../src/widgets/index.js';

const config = normalizeConfig({ stops: '1022', bike_stations: '3', language: 'fr' });

function routes(extra = {}) {
  return {
    '/v5/stoptimes': stopTimesPayload(
      Date.now(),
      Array.from({ length: 12 }, (_, index) => ({ minutes: 2 + index * 4 })),
    ),
    ...bikeRoutes(),
    ...extra,
  };
}

function assertValid(content) {
  assert.deepEqual(validateWidgetContent(content), []);
}

beforeEach(() => {
  clearReadings();
  clearBikeCache();
});
afterEach(() => restoreFetch());

test('the departures board is valid and capped', async () => {
  stubFetch(routes());
  const content = await WIDGETS.departures(createFakeGladys(), {
    settings: { stop: 'transit-stop:1022' },
    config,
  });
  assertValid(content);
  const board = content.components.find((component) => component.type === 'status');
  assert.equal(board.items.length, 8);
});

test('only the departures and àVélo cards exist in Québec', () => {
  assert.deepEqual(Object.keys(WIDGETS), ['departures', 'bike_station']);
});

test('the bike station card is valid', async () => {
  stubFetch(routes());
  const content = await WIDGETS.bike_station(createFakeGladys(), {
    settings: { station: 'bike-station:3' },
    config,
  });
  assertValid(content);
});

test('failures become a card that says what is wrong', async () => {
  stubFetch(routes({ '/v5/stoptimes': { status: 503, body: '' } }));
  const failed = await WIDGETS.departures(createFakeGladys(), {
    settings: { stop: 'transit-stop:1022' },
    config,
  });
  assertValid(failed);
  assert.match(failed.components[0].text.fr, /n’ont pas pu être lues/);

  const unset = await WIDGETS.departures(createFakeGladys(), { settings: {}, config });
  assertValid(unset);
  assert.match(unset.components[0].text.en, /Choose a stop/);
});

test('a slow API gets a loading card rather than a dashboard error', async () => {
  // An answer that comes, but long after the card's deadline.
  globalThis.fetch = () =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, status: 503, text: async () => '' }), 100),
    );
  const content = await WIDGETS.departures(
    createFakeGladys(),
    { settings: { stop: 'transit-stop:1022' }, config },
    { deadlineMs: 10 },
  );
  assertValid(content);
  assert.match(content.components[0].text.en, /longer than usual/);
});

test('truncate', () => {
  assert.equal(truncate('abc', 5), 'abc');
  assert.equal(truncate('abcdef', 5), 'abcd…');
});

test('a scheduled board is grey and marked "~", without asking for a key', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(Date.now(), [
      { minutes: 5 },
      { minutes: 20, routeId: '1-6', shortName: '6', headsign: "Terminus Place-D'Youville" },
    ]),
  });
  const content = await WIDGETS.departures(createFakeGladys(), {
    settings: { stop: 'transit-stop:1022' },
    config,
  });
  assertValid(content);
  const board = content.components.find((component) => component.type === 'status');
  assert.deepEqual(
    board.items.map((item) => [item.label.fr, item.color]),
    [
      ['Ligne 1 → Station Belvédère (Nord)', 'neutral'],
      ["Ligne 6 → Terminus Place-D'Youville", 'neutral'],
    ],
  );
  assert.match(board.items[0].value, /^~[45] min$/);
  // There is no key to get: the caption only explains the "~".
  assert.equal(content.components.at(-1).text.fr, '~ horaire prévu.');
});

test('an empty board says so', () => {
  const content = departuresContent('Arrêt', []);
  assertValid(content);
  assert.match(content.components[1].text.fr, /Aucun passage/);
});

test('a removed bike station gets a card that says so, not three zeros', () => {
  const content = bikeStationContent('àVélo – Gare du Palais', absentStation('3'));
  assertValid(content);
  assert.equal(
    content.components.some((component) => component.type === 'value'),
    false,
  );
  assert.match(content.components[1].text.fr, /retirée pour la saison/);
});
