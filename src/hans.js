// -----------------------------------------------------------------------------
// HANS client (USGS Volcano Hazards Program, Hazard Notification System): the
// public, keyless JSON API of https://volcanoes.usgs.gov/hans-public/api/.
//
//   - volcano/getMonitoredVolcanoes: the ~70 monitored US volcanoes, each with
//     its current alert level, aviation colour code and newest notice. Two
//     rows are regional summaries without a volcano number ("Cascade Range"):
//     dropped. A volcano without any notice has an empty notice type and a
//     null identifier (Isanotski, 12/11/2026);
//   - volcano/getUSVolcanoes: the ~170 US volcanoes with their position, read
//     once a day (it never changes) for the distances;
//   - volcano/getCapElevated: the CAP alerts of the volcanoes at or recently
//     above ORANGE / WATCH, with a one-line synopsis of their newest notice.
//     Optional: a failure there only loses the synopsis.
//
// USGS data are in the public domain. No header carries a secret.
// -----------------------------------------------------------------------------

import { COLORS, LEVELS } from './config.js';

export const API_BASE = 'https://volcanoes.usgs.gov/hans-public/api';
export const HANS_SITE = 'https://volcanoes.usgs.gov/hans-public/';
export const MONITORED_URL = `${API_BASE}/volcano/getMonitoredVolcanoes`;
export const US_VOLCANOES_URL = `${API_BASE}/volcano/getUSVolcanoes`;
export const CAP_URL = `${API_BASE}/volcano/getCapElevated`;
export const USER_AGENT =
  'gladys-usgs-volcanoes (Gladys Assistant integration; +https://github.com/guim31/gladys-usgs-volcanoes)';

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {number|null} status HTTP status, null for a network error or a bad body
   */
  constructor(message, status = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * GET `url` and parse its JSON body.
 * @param {Function} fetchImpl fetch
 * @param {string} url
 */
export async function getJson(fetchImpl, url, { timeoutMs = 30000 } = {}) {
  const host = new URL(url).host;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} s` : err.message;
    throw new HttpError(`${host}: ${reason}`);
  }
  if (response.status !== 200) {
    throw new HttpError(`${host}: HTTP ${response.status}`, response.status);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(`${host}: the answer is not JSON`, response.status);
  }
}

const LEVEL_BY_HANS = Object.fromEntries(LEVELS.map((level) => [level.hans, level.key]));
const COLOR_BY_HANS = Object.fromEntries(COLORS.map((color) => [color.hans, color.key]));

const clean = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const https = (url) =>
  typeof url === 'string' && url.startsWith('https://') ? url.replaceAll('\\/', '/') : null;

export const NOTICE_TYPES = ['DU', 'WU', 'MU', 'IS', 'VV'];

/**
 * One row of getMonitoredVolcanoes as a plain volcano, or null without a
 * volcano number. `level` and `color` are null when HANS gives none we know
 * ("UNASSIGNED").
 */
export function parseMonitored(row) {
  const vnum = typeof row?.vnum === 'string' && /^\d+$/.test(row.vnum) ? row.vnum : null;
  if (!vnum) {
    return null;
  }
  const hasNotice = typeof row.notice_identifier === 'string' && row.notice_identifier !== '';
  const sent = Number(row.sent_unixtime);
  return {
    vnum,
    name: clean(row.volcano_name) || vnum,
    code: clean(row.volcano_cd),
    observatory: clean(row.obs_abbr).toLowerCase(),
    observatoryName: clean(row.obs_fullname),
    level: LEVEL_BY_HANS[clean(row.alert_level).toUpperCase()] ?? null,
    color: COLOR_BY_HANS[clean(row.color_code).toUpperCase()] ?? null,
    notice: hasNotice
      ? {
          id: row.notice_identifier,
          type: NOTICE_TYPES.includes(row.notice_type_cd) ? row.notice_type_cd : null,
          sentAt: Number.isFinite(sent) && sent > 0 ? sent * 1000 : null,
          url: https(row.notice_url),
        }
      : null,
  };
}

/** getUSVolcanoes as a map vnum → { latitude, longitude, region, url }. */
export function parsePositions(rows) {
  const positions = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const { vnum, latitude, longitude } = row ?? {};
    if (typeof vnum === 'string' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      positions.set(vnum, {
        latitude,
        longitude,
        region: clean(row.region),
        url: https(row.volcano_url),
      });
    }
  }
  return positions;
}

/** getCapElevated as a map notice identifier → synopsis. */
export function parseSynopses(rows) {
  const synopses = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const synopsis = clean(row?.synopsis);
    if (typeof row?.notice_identifier === 'string' && synopsis) {
      synopses.set(row.notice_identifier, synopsis);
    }
  }
  return synopses;
}

/** The monitored volcanoes; throws an HttpError when HANS fails. */
export async function fetchMonitored(fetchImpl) {
  const rows = await getJson(fetchImpl, MONITORED_URL);
  if (!Array.isArray(rows)) {
    throw new HttpError(`${new URL(MONITORED_URL).host}: unexpected answer`);
  }
  return rows.map(parseMonitored).filter(Boolean);
}

export async function fetchPositions(fetchImpl) {
  return parsePositions(await getJson(fetchImpl, US_VOLCANOES_URL));
}

export async function fetchSynopses(fetchImpl) {
  return parseSynopses(await getJson(fetchImpl, CAP_URL));
}

/** Lower case, without accents nor punctuation: "Kīlauea" → "kilauea". */
export const normalizeName = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const withoutMount = (name) => name.replace(/^(mount|mt) /, '');

/**
 * The volcanoes the user typed, among the monitored ones. A query is a
 * Smithsonian number ("332010"), a USGS volcano code ("hi3"), an observatory
 * ("hvo": all its volcanoes), a name ("Mount St. Helens", "st helens",
 * "Kilauea") or a part of one name only. `unknown`: matching nothing or
 * several volcanoes.
 */
export function resolveQueries(queries, volcanoes) {
  const matched = new Map();
  const unknown = [];
  const observatories = new Set(volcanoes.map((volcano) => volcano.observatory));
  for (const query of queries) {
    const q = normalizeName(query);
    let found = volcanoes.filter(
      (v) =>
        v.vnum === q ||
        normalizeName(v.code) === q ||
        normalizeName(v.name) === q ||
        withoutMount(normalizeName(v.name)) === withoutMount(q),
    );
    if (found.length === 0 && observatories.has(q)) {
      found = volcanoes.filter((volcano) => volcano.observatory === q);
    }
    if (found.length === 0 && q.length >= 3) {
      const partial = volcanoes.filter((v) => normalizeName(v.name).includes(q));
      found = partial.length === 1 ? partial : [];
    }
    if (found.length === 0) {
      unknown.push(query);
    }
    for (const volcano of found) {
      matched.set(volcano.vnum, volcano);
    }
  }
  return { matched: [...matched.values()], unknown };
}
