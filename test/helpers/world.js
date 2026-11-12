// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake HANS serving the
// answers recorded on 12/11/2026 (test/fixtures/hans), a manual clock, a
// temporary /data, and the integration wired on top through registerHandlers.
// Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

// The answers were recorded on 12/11/2026 around 08:05 UTC.
export const START = Date.parse('2026-11-12T08:10:00Z');

// A house in Seattle (public coordinates of the city centre): Mount Rainier
// 94 km, Glacier Peak 107 km, Mount Baker 136 km, Mount St. Helens 157 km,
// Mount Adams 168 km, Mount Hood 253 km.
export const HOUSE = {
  id: 'house-1',
  name: 'Home',
  selector: 'home',
  latitude: 47.6062,
  longitude: -122.3321,
};

export const KILAUEA = '332010'; // ADVISORY / YELLOW, with a CAP synopsis
export const GREAT_SITKIN = '311120'; // WATCH / ORANGE, with a CAP synopsis
export const AHYI = '284141'; // ADVISORY / YELLOW, no synopsis
export const RAINIER = '321030'; // NORMAL / GREEN
export const ST_HELENS = '321050'; // NORMAL / GREEN
export const ISANOTSKI = '311370'; // NORMAL / GREEN, no notice at all

const PATHS = {
  '/hans-public/api/volcano/getMonitoredVolcanoes': 'monitored',
  '/hans-public/api/volcano/getUSVolcanoes': 'us',
  '/hans-public/api/volcano/getCapElevated': 'cap',
};

/**
 * Fake HANS. `api.down`: 'network' (connection refused), a status (503) or
 * false; `api.downOnly`: the one endpoint that fails ('cap', 'us'…).
 */
export function createApi() {
  const api = {
    monitored: fixture('hans/monitored-2026-11-12.json'),
    us: fixture('hans/us-volcanoes-2026-11-12.json'),
    cap: fixture('hans/cap-elevated-2026-11-12.json'),
    down: false,
    downOnly: null,
    requests: [],

    row(vnum) {
      return api.monitored.find((row) => row.vnum === vnum);
    },

    /** New level and colour, with a new notice sent at `time` (ms). */
    setLevel(vnum, level, color, time = START) {
      const row = api.row(vnum);
      row.alert_level = level;
      row.color_code = color;
      row.notice_identifier = `DOI-USGS-TEST-${vnum}-${time}`;
      row.notice_type_cd = 'VV';
      row.sent_unixtime = Math.floor(time / 1000);
      row.notice_url = `https://volcanoes.usgs.gov/hans-public/notice/${row.notice_identifier}`;
    },

    async fetch(input) {
      const url = new URL(input);
      api.requests.push(url);
      const name = PATHS[url.pathname];
      if (api.down === 'network' && (!api.downOnly || api.downOnly === name)) {
        throw new TypeError('fetch failed');
      }
      if (api.down && (!api.downOnly || api.downOnly === name)) {
        return { status: api.down, text: async () => 'Service Unavailable' };
      }
      if (!name) {
        return { status: 404, text: async () => 'Not Found' };
      }
      return { status: 200, text: async () => JSON.stringify(api[name]) };
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = { volcanoes: 'Kilauea, Mount Rainier' },
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-usgs-volcanoes-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, { store, fetch: api.fetch, timers, now: clock.now });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** The devices discovered last. */
export const discovered = (world) => world.fake.discoveredDevices;

/** Create every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of discovered(world)) {
    await world.fake.deviceCreated(device);
  }
  return discovered(world);
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** The last value published on a feature (state, or text). */
export function lastValue(world, device, key) {
  const id = featureId(device, key);
  const state = world.fake.states.filter((s) => s.device_feature_external_id === id).at(-1);
  return state?.text ?? state?.state;
}

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 15) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
