// -----------------------------------------------------------------------------
// The monitor end to end, against the SDK's fake Gladys and the recorded HANS
// answers: discovery, states, the nearby device, the scene trigger, failures,
// the container's own timer and the reconfiguration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AHYI,
  GREAT_SITKIN,
  ISANOTSKI,
  KILAUEA,
  RAINIER,
  ST_HELENS,
  createAll,
  createApi,
  createWorld,
  cycle,
  discovered,
  lastValue,
} from './helpers/world.js';

const deviceOf = (world, vnum) =>
  discovered(world).find((device) => device.external_id.endsWith(`:volcano:${vnum}`));
const nearbyOf = (world) =>
  discovered(world).find((device) => device.external_id.endsWith(':nearby:area'));

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('one device per followed volcano, and "nearby volcanoes" with a radius', async (t) => {
  const w = await world(t, {
    config: { volcanoes: 'Kīlauea; st helens\n311120, Etna, Sitkin', language: 'en' },
  });
  assert.deepEqual(
    discovered(w).map((device) => device.name),
    ['Volcano Great Sitkin', 'Volcano Kilauea', 'Volcano Mount St. Helens', 'Nearby volcanoes'],
  );
  assert.deepEqual(w.monitor.unknown, ['Etna', 'Sitkin']);
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.match(w.fake.connectionStatus.message.en, /or ambiguous: Etna, Sitkin\./);
  assert.match(w.fake.connectionStatus.message.fr, /ou ambigu : Etna, Sitkin\./);
});

test('an observatory code follows all its volcanoes; radius off: no nearby device', async (t) => {
  const w = await world(t, { config: { volcanoes: 'yvo, nmi', radius: '0' } });
  assert.deepEqual(
    discovered(w).map((device) => device.name),
    ['Volcan Ahyi Seamount', 'Volcan Yellowstone'],
  );
});

test('the states of a volcano: level, colour, newest notice with its synopsis', async (t) => {
  const w = await world(t, {
    config: { volcanoes: `Kilauea, Great Sitkin, Isanotski, ${AHYI}`, language: 'en' },
  });
  await createAll(w);
  const kilauea = deviceOf(w, KILAUEA);
  assert.equal(lastValue(w, kilauea, 'alert_level'), 1);
  assert.equal(lastValue(w, kilauea, 'aviation_color'), 1);
  assert.match(
    lastValue(w, kilauea, 'latest_notice'),
    /^Daily update, 11\/11\/2026: The Halema'uma'u eruption of Kīlauea remains paused/,
  );
  const sitkin = deviceOf(w, GREAT_SITKIN);
  assert.equal(lastValue(w, sitkin, 'alert_level'), 2);
  assert.equal(lastValue(w, sitkin, 'aviation_color'), 2);
  // Ahyi: elevated, but no CAP synopsis.
  assert.equal(lastValue(w, deviceOf(w, AHYI), 'latest_notice'), 'Weekly update, 06/11/2026');
  // Isanotski: no notice at all in HANS.
  assert.equal(lastValue(w, deviceOf(w, ISANOTSKI), 'latest_notice'), 'No USGS notice yet');
});

test('no state before the user creates a device, all of them right after', async (t) => {
  const w = await world(t);
  assert.equal(w.fake.states.length, 0);
  await w.fake.deviceCreated(deviceOf(w, RAINIER));
  const rainier = deviceOf(w, RAINIER);
  assert.equal(lastValue(w, rainier, 'alert_level'), 0);
  assert.equal(lastValue(w, rainier, 'aviation_color'), 0);
  assert.equal(lastValue(w, deviceOf(w, KILAUEA), 'alert_level'), undefined);
  assert.ok(w.fake.widgetRefreshes.length > 0);
});

test('nearby: highest level, count above normal and the volcano concerned', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { radius: '200', language: 'en' } });
  await createAll(w);
  const nearby = nearbyOf(w);
  assert.equal(lastValue(w, nearby, 'highest_level'), 0);
  assert.equal(lastValue(w, nearby, 'elevated_count'), 0);
  assert.equal(lastValue(w, nearby, 'highest_volcano'), 'No volcano above normal nearby');
  api.setLevel(ST_HELENS, 'ADVISORY', 'YELLOW');
  api.setLevel(RAINIER, 'WATCH', 'ORANGE');
  await cycle(w);
  assert.equal(lastValue(w, nearby, 'highest_level'), 2);
  assert.equal(lastValue(w, nearby, 'elevated_count'), 2);
  assert.equal(lastValue(w, nearby, 'highest_volcano'), 'Mount Rainier: Watch / Orange, 94 km');
});

test('only the changes are published, and an unchanged value every 12 hours', async (t) => {
  const w = await world(t);
  await createAll(w);
  const before = w.fake.states.length;
  await cycle(w);
  await cycle(w);
  assert.equal(w.fake.states.length, before);
  // The SDK republishes an unchanged value after `heartbeat` ms (its own clock).
  const publish = t.mock.method(w.gladys, 'publishChangedStates');
  await cycle(w);
  assert.equal(publish.mock.calls[0].arguments[1].heartbeat, 12 * 60 * 60 * 1000);
});

test('the trigger fires on a change of a followed or nearby volcano, with its data', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { volcanoes: 'Kilauea', language: 'fr' } });
  assert.equal(w.fake.sceneEvents.length, 0, 'the first start only records');
  api.setLevel(KILAUEA, 'WATCH', 'ORANGE');
  api.setLevel(RAINIER, 'ADVISORY', 'YELLOW');
  // Out of scope: neither followed nor within 200 km of Seattle.
  api.setLevel(AHYI, 'NORMAL', 'GREEN');
  await cycle(w);
  assert.deepEqual(
    w.fake.sceneEvents.map((event) => [event.key, event.data.volcano, event.data.direction]),
    [
      ['alert_changed', 'Mount Rainier', 'raised'],
      ['alert_changed', 'Kilauea', 'raised'],
    ],
  );
  assert.deepEqual(w.fake.sceneEvents[0].data, {
    alert_level: 'advisory',
    aviation_color: 'yellow',
    direction: 'raised',
    volcano: 'Mount Rainier',
    vnum: RAINIER,
    observatory: 'CVO',
    alert_level_name: 'Vigilance',
    aviation_color_name: 'Jaune',
    previous_alert_level: 'normal',
    previous_aviation_color: 'green',
    distance_km: 94,
    summary: 'Mount Rainier : Vigilance / Jaune, à 94 km',
    notice_url: `https://volcanoes.usgs.gov/hans-public/notice/DOI-USGS-TEST-${RAINIER}-${w.clock.time - 15 * 60 * 1000}`,
  });
  await cycle(w);
  assert.equal(w.fake.sceneEvents.length, 2, 'nothing new, nothing fired');
  api.setLevel(KILAUEA, 'WATCH', 'YELLOW');
  await cycle(w);
  assert.equal(w.fake.sceneEvents.at(-1).data.direction, 'lowered', 'a colour alone counts');
});

test('a restart fires nothing for a change already seen; a new volcano followed neither', async (t) => {
  const api = createApi();
  const first = await createWorld({ api });
  api.setLevel(KILAUEA, 'WARNING', 'RED');
  await cycle(first);
  assert.equal(first.fake.sceneEvents.length, 1);
  await first.app.stop();
  const again = await world(t, { api, dataDir: first.dataDir, config: { volcanoes: 'Kilauea' } });
  assert.equal(again.fake.sceneEvents.length, 0);
  await again.fake.configUpdated({ volcanoes: 'Kilauea, Great Sitkin' });
  assert.equal(again.fake.sceneEvents.length, 0);
  assert.ok(deviceOf(again, GREAT_SITKIN));
});

test('the level change date is kept for the widget', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  assert.equal(w.monitor.shown().find((v) => v.vnum === KILAUEA).changedAt, null);
  api.setLevel(KILAUEA, 'WATCH', 'ORANGE');
  await cycle(w);
  const at = w.clock.time;
  await cycle(w);
  assert.equal(w.monitor.shown().find((v) => v.vnum === KILAUEA).changedAt, at);
});

test('HANS down at the start: the nearby device is there, the status says why', async (t) => {
  const api = createApi();
  api.down = 503;
  const w = await world(t, { api });
  assert.deepEqual(
    discovered(w).map((device) => device.name),
    ['Volcans proches'],
  );
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /HANS\) does not answer/);
  api.down = false;
  await cycle(w);
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.equal(discovered(w).length, 3);
});

test('without the CAP synopses or the positions, the levels still come', async (t) => {
  const api = createApi();
  api.down = 503;
  api.downOnly = 'cap';
  const w = await world(t, { api, config: { volcanoes: 'Kilauea', language: 'en' } });
  await createAll(w);
  assert.equal(lastValue(w, deviceOf(w, KILAUEA), 'latest_notice'), 'Daily update, 11/11/2026');
  api.downOnly = 'us';
  const blind = await world(t, { api, config: { volcanoes: 'Kilauea' } });
  assert.equal(blind.monitor.followed[0].level, 'advisory');
  assert.equal(blind.monitor.followed[0].distanceKm, null);
});

test('a radius without any centre: said in the status, no nearby state', async (t) => {
  const w = await world(t, { houses: [], config: { radius: '200', volcanoes: 'Kilauea' } });
  await createAll(w);
  assert.match(w.fake.connectionStatus.message.en, /No centre for the nearby volcanoes/);
  assert.equal(lastValue(w, nearbyOf(w), 'highest_level'), undefined);
  const nothing = await world(t, { config: { radius: '0' } });
  assert.match(nothing.fake.connectionStatus.message.en, /No volcano followed/);
});

test('typed coordinates replace the house', async (t) => {
  const w = await world(t, {
    houses: [],
    config: { radius: '100', latitude: '19,40', longitude: '-155,28', language: 'en' },
  });
  await createAll(w);
  assert.equal(lastValue(w, nearbyOf(w), 'highest_level'), 1);
  assert.match(lastValue(w, nearbyOf(w), 'highest_volcano'), /^Kilauea: Advisory \/ Yellow, 2 km$/);
});

test('the container reads HANS on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const api = createApi();
  const w = await world(t, { api, timers: true });
  const before = api.requests.length;
  t.mock.timers.tick(15 * 60 * 1000);
  await w.monitor.running;
  assert.ok(api.requests.length > before);
});

test('onPoll fallback: reads again only when the last cycle is old enough', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  const [device] = await createAll(w);
  const before = api.requests.length;
  await w.fake.poll(device);
  assert.equal(api.requests.length, before);
  w.clock.advance(8 * 60 * 1000);
  await w.fake.poll(device);
  assert.ok(api.requests.length > before);
});

test('a scan request publishes the devices again', async (t) => {
  const w = await world(t);
  const before = w.fake.bodies('POST', '/discovered_device').length;
  await w.fake.scanRequest();
  assert.equal(w.fake.bodies('POST', '/discovered_device').length, before + 1);
});

test('a volcano without a known level is "not rated", never "undefined"', async (t) => {
  const api = createApi();
  api.row(KILAUEA).alert_level = 'UNASSIGNED';
  api.row(KILAUEA).color_code = 'UNASSIGNED';
  const w = await world(t, { api, config: { volcanoes: 'Kilauea', language: 'en' } });
  await createAll(w);
  assert.equal(
    w.monitor.sentence('en'),
    'No volcano above normal: Kilauea: Not rated / Not rated, 4,317 km.',
  );
  assert.equal(lastValue(w, deviceOf(w, KILAUEA), 'alert_level'), undefined);
});

test('without the positions, the nearby device publishes no false "all clear"', async (t) => {
  const api = createApi();
  api.down = 403;
  api.downOnly = 'us';
  const w = await world(t, { api, config: { radius: '200' } });
  await createAll(w);
  assert.equal(lastValue(w, nearbyOf(w), 'highest_level'), undefined);
  api.down = false;
  await cycle(w, 24 * 60);
  assert.equal(lastValue(w, nearbyOf(w), 'highest_level'), 0);
});

test('HANS down after a good cycle: the scene action fails rather than read old levels', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  api.down = 503;
  await cycle(w);
  const result = await w.fake.sceneAction('read_volcanoes', {});
  assert.equal(result.success, false);
});
