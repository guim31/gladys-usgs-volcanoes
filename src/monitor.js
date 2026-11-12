// -----------------------------------------------------------------------------
// The monitor: reads the alert levels of the monitored US volcanoes every
// `refresh_interval` minutes (HANS), publishes the devices and their states,
// fires the scene trigger and serves the widget and the actions.
//
// In scope: the followed volcanoes (typed in the configuration) and every
// monitored volcano within the radius of the centre (the configured
// coordinates, or the first located house of Gladys). The widget and the
// sentences list the followed volcanoes, and the nearby ones above normal.
//
// Trigger: `alert_changed` when the alert level or the aviation colour code of
// a volcano in scope changes. The levels of all monitored volcanoes are kept
// under /data, so a restart fires nothing, nor does a volcano newly followed;
// the very first start only records them.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat every
// 12 hours. The coordinates of the centre are never logged.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { colorRank, levelRank } from './config.js';
import { buildNearbyDevice, buildVolcanoDevice, nearbyIds, volcanoIds } from './device.js';
import { distanceKm } from './geo.js';
import { fetchMonitored, fetchPositions, fetchSynopses, resolveQueries } from './hans.js';
import {
  COLOR_NAMES,
  LEVEL_NAMES,
  PHRASES,
  STATUS,
  describe,
  join,
  latestNoticeText,
  render,
  sentence,
} from './messages.js';

const logger = createLogger({ name: 'usgs-volcanoes' });

export const WIDGET_KEY = 'volcanoes';
export const TRIGGER = 'alert_changed';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // The positions of the volcanoes do not move: read again once a day.
  positionsMaxAgeMs: 24 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
  // The houses of Gladys are read again this often (no update event).
  housesMaxAgeMs: HOUR,
};

/** Highest alert level first, then colour, then nearest, then name. */
export const byActivity = (a, b) =>
  levelRank(b.level) - levelRank(a.level) ||
  colorRank(b.color) - colorRank(a.color) ||
  (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
  a.name.localeCompare(b.name);

const isElevated = (volcano) => levelRank(volcano.level) > 0 || colorRank(volcano.color) > 0;

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? ((...args) => fetch(...args));
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // Every monitored volcano of the last successful cycle, with its distance.
    this.volcanoes = [];
    this.followed = [];
    this.unknown = [];
    this.nearby = [];
    this.positions = new Map();
    this.positionsAt = -Infinity;
    this.lastSuccessAt = null;
    this.lastCycleAt = -Infinity;
    this.house = undefined;
    this.houseReadAt = -Infinity;
    this.statusMessage = undefined;
    this.discoveredSignature = null;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.widgetSignature = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1 && saved.known && typeof saved.known === 'object') {
      this.data = { ...emptyData(), ...saved };
    }
    this.warnAboutConfig();
    logger.info(`Started: USGS volcano alert levels read every ${config.refreshMinutes} min`);
    await this.runCycle();
    // The nearby device needs no HANS answer: published even if HANS is down.
    await this.publishDiscovered();
    this.schedule();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    this.houseReadAt = -Infinity;
    await this.publishDiscovered(true);
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    // A cycle already running finishes with the old configuration first.
    await this.running;
    this.config = config;
    this.houseReadAt = -Infinity;
    logger.info('Configuration saved');
    this.warnAboutConfig();
    this.schedule();
    await this.runCycle();
    // The language may have changed: the names of new devices follow it.
    await this.publishDiscovered(true);
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  warnAboutConfig() {
    if (this.config.invalidCenter) {
      logger.warn('The coordinates of the configuration are not valid: the house is used');
    }
  }

  /** The devices to discover: the followed volcanoes, and "nearby" with a radius. */
  discoveredDevices() {
    const language = this.config.language;
    const devices = this.followed.map((volcano) =>
      buildVolcanoDevice(this.gladys, volcano, language),
    );
    if (this.config.radiusKm > 0) {
      devices.push(buildNearbyDevice(this.gladys, language));
    }
    return devices;
  }

  /** Publish the discovered devices when they changed (or always, `force`). */
  async publishDiscovered(force = false) {
    const devices = this.discoveredDevices();
    const signature = JSON.stringify(devices);
    if (!force && signature === this.discoveredSignature) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discoveredSignature = signature;
      this.recovered('discovery', 'Publishing the discovered devices works again');
    } catch (err) {
      this.failed('discovery', 'warn', `Publishing the discovered devices failed: ${err.message}`);
    }
  }

  /** The vnums of the volcano devices created in Gladys, and whether "nearby" is. */
  created() {
    const vnums = new Set();
    let nearby = false;
    const nearbyId = nearbyIds(this.gladys).device;
    const prefix = volcanoIds(this.gladys, '').device;
    for (const device of this.gladys.devices ?? []) {
      const id = device?.external_id ?? '';
      if (id === nearbyId) {
        nearby = true;
      } else if (id.startsWith(prefix)) {
        vnums.add(id.slice(prefix.length));
      }
    }
    return { vnums, nearby };
  }

  // --- Centre ------------------------------------------------------------------

  /** The centre: the configured coordinates, else the first located house. */
  async center() {
    if (this.config.center) {
      return this.config.center;
    }
    if (this.now() - this.houseReadAt >= this.timings.housesMaxAgeMs) {
      try {
        const houses = await this.gladys.getHouses();
        this.house =
          houses.find(
            (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
          ) ?? null;
        this.houseReadAt = this.now();
        this.recovered('houses', 'The houses of Gladys are readable again');
      } catch (err) {
        this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      }
    }
    return this.house ? { latitude: this.house.latitude, longitude: this.house.longitude } : null;
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async readPositions() {
    if (this.now() - this.positionsAt < this.timings.positionsMaxAgeMs) {
      return;
    }
    try {
      const positions = await fetchPositions(this.fetch);
      if (positions.size > 0) {
        this.positions = positions;
        this.positionsAt = this.now();
      }
      this.recovered('positions', 'The positions of the volcanoes are readable again');
    } catch (err) {
      this.failed(
        'positions',
        'warn',
        `Cannot read the positions of the volcanoes: ${err.message}`,
      );
    }
  }

  async cycle() {
    this.lastCycleAt = this.now();
    let monitored;
    try {
      monitored = await fetchMonitored(this.fetch);
      this.recovered('hans', 'The USGS (HANS) answers again');
    } catch (err) {
      this.failed('hans', 'warn', `USGS (HANS) unreachable: ${err.message}`);
      await this.updateConnectionStatus();
      return;
    }
    let synopses = new Map();
    try {
      synopses = await fetchSynopses(this.fetch);
    } catch (err) {
      // Only the synopses are lost: the levels are there.
      logger.debug(`No CAP synopsis this cycle: ${err.message}`);
    }
    await this.readPositions();
    const center = await this.center();
    this.volcanoes = monitored.map((volcano) => {
      const position = this.positions.get(volcano.vnum);
      const known = this.data.known[volcano.vnum];
      return {
        ...volcano,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        url: position?.url ?? null,
        synopsis: volcano.notice ? (synopses.get(volcano.notice.id) ?? null) : null,
        changedAt: known && known.level === volcano.level ? (known.changedAt ?? null) : null,
        distanceKm:
          center && position
            ? distanceKm(center.latitude, center.longitude, position.latitude, position.longitude)
            : null,
      };
    });
    const { matched, unknown } = resolveQueries(this.config.queries, this.volcanoes);
    this.followed = matched.sort(byActivity);
    this.unknown = unknown;
    const radius = this.config.radiusKm;
    this.nearby =
      radius > 0
        ? this.volcanoes
            .filter((volcano) => volcano.distanceKm !== null && volcano.distanceKm <= radius)
            .sort(byActivity)
        : [];
    logger.debug(
      `Refresh cycle: ${this.volcanoes.length} monitored volcano(es), ${this.followed.length} followed, ${this.nearby.length} nearby`,
    );
    await this.detectChanges();
    this.lastSuccessAt = this.now();
    this.recovered('cycle', 'Refresh cycles work again');
    await this.publishDiscovered();
    await this.publishStates();
    await this.updateConnectionStatus();
    const signature = JSON.stringify(
      this.shown().map((v) => [v.vnum, v.level, v.color, v.notice?.id]),
    );
    if (signature !== this.widgetSignature) {
      this.widgetSignature = signature;
      this.requestRefresh();
    }
  }

  /** In scope for the trigger: followed, or within the radius. */
  inScope(vnum) {
    return (
      this.followed.some((volcano) => volcano.vnum === vnum) ||
      this.nearby.some((volcano) => volcano.vnum === vnum)
    );
  }

  /** The volcanoes the widget and the sentences list: followed, and nearby above normal. */
  shown() {
    const list = new Map(this.followed.map((volcano) => [volcano.vnum, volcano]));
    for (const volcano of this.nearby) {
      if (isElevated(volcano)) {
        list.set(volcano.vnum, volcano);
      }
    }
    return [...list.values()].sort(byActivity);
  }

  /** Fire the scene trigger, and remember the levels of every monitored volcano. */
  async detectChanges() {
    const now = this.now();
    const known = this.data.known;
    // The very first start only records: nothing changed yet.
    const seed = Object.keys(known).length === 0;
    const changes = [];
    for (const volcano of this.volcanoes) {
      const before = known[volcano.vnum];
      if (!before) {
        known[volcano.vnum] = { level: volcano.level, color: volcano.color, changedAt: null };
        continue;
      }
      if (before.level === volcano.level && before.color === volcano.color) {
        continue;
      }
      if (before.level !== volcano.level) {
        before.changedAt = now;
        volcano.changedAt = now;
      }
      const previous = { level: before.level, color: before.color };
      before.level = volcano.level;
      before.color = volcano.color;
      if (!seed && volcano.level && volcano.color && previous.level && previous.color) {
        changes.push({ volcano, previous });
      }
    }
    this.store.save(this.data);
    for (const change of changes) {
      if (this.inScope(change.volcano.vnum)) {
        await this.fire(change);
      }
    }
  }

  async fire({ volcano, previous }) {
    const data = this.eventData(volcano, previous);
    logger.info(
      `${volcano.name}: ${previous.level} / ${previous.color} → ${volcano.level} / ${volcano.color}`,
    );
    try {
      await this.gladys.publishSceneEvent(TRIGGER, data);
      this.recovered('scene', 'Scene triggers work again');
    } catch (err) {
      this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
    }
  }

  /** The flat data of a scene event (fields, then variables of the manifest). */
  eventData(volcano, previous) {
    const language = this.config.language;
    const raised =
      levelRank(volcano.level) - levelRank(previous.level) ||
      colorRank(volcano.color) - colorRank(previous.color);
    return {
      alert_level: volcano.level,
      aviation_color: volcano.color,
      direction: raised > 0 ? 'raised' : 'lowered',
      volcano: volcano.name,
      vnum: volcano.vnum,
      observatory: volcano.observatory.toUpperCase(),
      alert_level_name: LEVEL_NAMES[language][volcano.level],
      aviation_color_name: COLOR_NAMES[language][volcano.color],
      previous_alert_level: previous.level,
      previous_aviation_color: previous.color,
      distance_km: volcano.distanceKm === null ? null : Math.round(volcano.distanceKm),
      summary: describe(volcano, language),
      notice_url: volcano.notice?.url ?? null,
    };
  }

  // --- States ------------------------------------------------------------------

  statesOf() {
    // HANS down: the old values are not renewed by the heartbeat as if fresh.
    if (this.lastSuccessAt === null || this.failing.has('hans')) {
      return [];
    }
    const language = this.config.language;
    const created = this.created();
    const states = [];
    for (const volcano of this.volcanoes) {
      if (!created.vnums.has(volcano.vnum)) {
        continue;
      }
      const ids = volcanoIds(this.gladys, volcano.vnum);
      // An unassigned level is no level: nothing published rather than a false one.
      if (volcano.level) {
        states.push({ device_feature_external_id: ids.level, state: levelRank(volcano.level) });
      }
      if (volcano.color) {
        states.push({ device_feature_external_id: ids.color, state: colorRank(volcano.color) });
      }
      states.push({
        device_feature_external_id: ids.notice,
        text: latestNoticeText(volcano, language),
      });
    }
    // Without the positions, every distance is unknown: no false "all clear".
    if (
      created.nearby &&
      this.config.radiusKm > 0 &&
      (this.config.center || this.house) &&
      this.positions.size > 0
    ) {
      const ids = nearbyIds(this.gladys);
      const elevated = this.nearby.filter(isElevated);
      const top = elevated[0];
      states.push(
        {
          device_feature_external_id: ids.level,
          state: Math.max(0, ...this.nearby.map((volcano) => levelRank(volcano.level))),
        },
        { device_feature_external_id: ids.count, state: elevated.length },
        {
          device_feature_external_id: ids.volcano,
          text: top ? describe(top, language) : PHRASES[language].noneNearby,
        },
      );
    }
    return states;
  }

  async publishStates() {
    const states = this.statesOf();
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const parts = [];
    if (this.failing.has('hans')) {
      parts.push(render(STATUS, 'hansDown'));
    }
    const { queries, radiusKm, center, invalidCenter } = this.config;
    if (queries.length === 0 && radiusKm === 0) {
      parts.push(render(STATUS, 'nothing'));
    }
    if (radiusKm > 0 && !center && !this.house) {
      parts.push(render(STATUS, 'noCenter'));
    } else if (invalidCenter) {
      parts.push(render(STATUS, 'invalidCenter'));
    }
    if (this.unknown.length > 0) {
      parts.push(render(STATUS, 'unknown', { values: this.unknown.join(', ') }));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('hans') && this.lastSuccessAt !== null;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  isOurs(device) {
    const id = device?.external_id ?? '';
    return (
      id.startsWith(volcanoIds(this.gladys, '').device) || id === nearbyIds(this.gladys).device
    );
  }

  async onDeviceCreated(device) {
    if (!this.isOurs(device)) {
      return;
    }
    if (this.lastSuccessAt === null) {
      await this.runCycle();
    }
    // The SDK forgot the states of the created device: they are published again.
    await this.publishStates();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (!this.isOurs(device)) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  /** The volcanoes shown, read again if the last cycle is older than one interval. */
  async fresh() {
    if (this.now() - this.lastCycleAt >= this.config.refreshMinutes * MINUTE) {
      await this.runCycle();
    } else {
      await this.running;
    }
    // The last cycle failed: the levels are not current, the actions say so.
    return {
      volcanoes: this.shown(),
      ok: this.lastSuccessAt !== null && !this.failing.has('hans'),
    };
  }

  /** The sentence of the actions. */
  sentence(language) {
    return sentence(this.shown(), language);
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

function emptyData() {
  return { version: 1, known: {} };
}
