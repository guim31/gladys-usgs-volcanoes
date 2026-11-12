// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The ground-based Volcano Alert Level of the USGS, lowest first. `rank` is
// also the value of the "alert level" features (the risk badge of Gladys:
// 0 "no risk" … 3 "high"). `hans` is the word of the HANS API.
export const LEVELS = [
  { key: 'normal', hans: 'NORMAL', rank: 0 },
  { key: 'advisory', hans: 'ADVISORY', rank: 1 },
  { key: 'watch', hans: 'WATCH', rank: 2 },
  { key: 'warning', hans: 'WARNING', rank: 3 },
];
export const LEVEL_KEYS = LEVELS.map((level) => level.key);

// The Aviation Color Code (ICAO), lowest first, same ranks.
export const COLORS = [
  { key: 'green', hans: 'GREEN', rank: 0 },
  { key: 'yellow', hans: 'YELLOW', rank: 1 },
  { key: 'orange', hans: 'ORANGE', rank: 2 },
  { key: 'red', hans: 'RED', rank: 3 },
];
export const COLOR_KEYS = COLORS.map((color) => color.key);

export const levelRank = (key) => LEVELS.find((level) => level.key === key)?.rank ?? -1;
export const colorRank = (key) => COLORS.find((color) => color.key === key)?.rank ?? -1;

// Kilometres around the house; 0 turns the "nearby volcanoes" device off.
// Volcanic hazards (ash fall, lahars, gas) reach a few hundred kilometres.
export const RADII = ['0', '50', '100', '200', '500', '1000'];

// Minutes between two readings. The observatories publish a few notices a
// day at most, and an alert level change comes with a notice.
export const REFRESH_INTERVALS = ['10', '15', '30', '60'];

export const DEFAULT_CONFIG = {
  volcanoes: '',
  radius: '200',
  latitude: '',
  longitude: '',
  refresh_interval: '15',
  language: 'fr',
};

/** A coordinate typed by the user (decimal comma accepted), null if blank or invalid. */
export function parseCoordinate(value, limit) {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Math.abs(number) <= limit ? number : null;
}

/**
 * The volcanoes typed by the user: names, Smithsonian numbers or observatory
 * codes, separated by commas, semicolons or new lines (names hold spaces).
 */
export function parseVolcanoQueries(text) {
  const seen = new Set();
  const queries = [];
  for (const token of String(text ?? '').split(/[,;\n]+/)) {
    const query = token.trim();
    if (query && !seen.has(query.toLowerCase())) {
      seen.add(query.toLowerCase());
      queries.push(query);
    }
  }
  return queries;
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const latitude = parseCoordinate(source.latitude, 90);
  const longitude = parseCoordinate(source.longitude, 180);
  // Both or none: half a centre falls back on the house.
  const center = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const typed = String(source.latitude ?? '').trim() + String(source.longitude ?? '').trim();
  return {
    queries: parseVolcanoQueries(source.volcanoes),
    radiusKm: pick(source.radius, RADII, DEFAULT_CONFIG.radius),
    center,
    // Something was typed but is not a pair of coordinates: said once in the logs.
    invalidCenter: center === null && typed !== '',
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
