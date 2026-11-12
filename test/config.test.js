// -----------------------------------------------------------------------------
// Normalization of the configuration: whatever Gladys stores, the code gets
// numbers, a list of queries and a centre or null.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseCoordinate, parseVolcanoQueries } from '../src/config.js';

test('defaults', () => {
  assert.deepEqual(normalizeConfig({}), {
    queries: [],
    radiusKm: 200,
    center: null,
    invalidCenter: false,
    refreshMinutes: 15,
    language: 'fr',
  });
  assert.deepEqual(normalizeConfig(null), normalizeConfig({}));
});

test('volcano queries: commas, semicolons, new lines; spaces kept; duplicates dropped', () => {
  assert.deepEqual(parseVolcanoQueries(' Mount St. Helens ;kilauea,\nKILAUEA,, '), [
    'Mount St. Helens',
    'kilauea',
  ]);
  assert.deepEqual(parseVolcanoQueries(undefined), []);
});

test('coordinates: decimal comma, bounds, both or none', () => {
  assert.equal(parseCoordinate('46,85', 90), 46.85);
  assert.equal(parseCoordinate('-121.76', 180), -121.76);
  assert.equal(parseCoordinate('91', 90), null);
  assert.equal(parseCoordinate('abc', 90), null);
  assert.deepEqual(normalizeConfig({ latitude: '46,85', longitude: '-121,76' }).center, {
    latitude: 46.85,
    longitude: -121.76,
  });
  const half = normalizeConfig({ latitude: '46.85' });
  assert.equal(half.center, null);
  assert.equal(half.invalidCenter, true);
});

test('unknown select values fall back on the defaults', () => {
  const config = normalizeConfig({ radius: '42', refresh_interval: '1', language: 'it' });
  assert.equal(config.radiusKm, 200);
  assert.equal(config.refreshMinutes, 15);
  assert.equal(config.language, 'fr');
  assert.equal(normalizeConfig({ radius: '0' }).radiusKm, 0);
});
