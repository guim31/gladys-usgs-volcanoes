// -----------------------------------------------------------------------------
// The HANS client: parsing of the recorded answers (12/11/2026), the matching
// of the volcanoes typed by the user, and the HTTP errors.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError,
  fetchMonitored,
  getJson,
  normalizeName,
  parseMonitored,
  parsePositions,
  parseSynopses,
  resolveQueries,
} from '../src/hans.js';
import { ISANOTSKI, KILAUEA, fixture } from './helpers/world.js';

const monitored = fixture('hans/monitored-2026-11-12.json');
const volcanoes = monitored.map(parseMonitored).filter(Boolean);

test('the monitored volcanoes, without the regional summaries', () => {
  assert.equal(monitored.length, 69);
  assert.equal(volcanoes.length, 67);
  assert.ok(!volcanoes.some((volcano) => volcano.name === 'Cascade Range'));
  const kilauea = volcanoes.find((volcano) => volcano.vnum === KILAUEA);
  assert.deepEqual(kilauea, {
    vnum: KILAUEA,
    name: 'Kilauea',
    code: 'hi3',
    observatory: 'hvo',
    observatoryName: 'Hawaiian Volcano Observatory',
    level: 'advisory',
    color: 'yellow',
    notice: {
      id: 'DOI-USGS-HVO-2026-11-11T17:28:12+00:00',
      type: 'DU',
      sentAt: 1794421551000,
      url: 'https://volcanoes.usgs.gov/hans-public/notice/DOI-USGS-HVO-2026-11-11T17:28:12+00:00',
    },
  });
  assert.equal(volcanoes.find((volcano) => volcano.vnum === ISANOTSKI).notice, null);
});

test('an unknown level or colour is no level', () => {
  const row = { ...monitored[0], alert_level: 'UNASSIGNED', color_code: 'UNASSIGNED' };
  assert.equal(parseMonitored(row).level, null);
  assert.equal(parseMonitored(row).color, null);
  assert.equal(parseMonitored({ ...monitored[0], vnum: null }), null);
});

test('positions and synopses', () => {
  const positions = parsePositions(fixture('hans/us-volcanoes-2026-11-12.json'));
  assert.equal(positions.size, 170);
  assert.deepEqual(positions.get(KILAUEA), {
    latitude: 19.421,
    longitude: -155.287,
    region: 'Hawaii',
    url: 'https://www.usgs.gov/volcanoes/kilauea',
  });
  for (const volcano of volcanoes) {
    assert.ok(positions.has(volcano.vnum), `${volcano.name} has a position`);
  }
  const synopses = parseSynopses(fixture('hans/cap-elevated-2026-11-12.json'));
  assert.match(synopses.get('DOI-USGS-AVO-2026-11-09T20:51:49+00:00'), /^Slow eruption of lava/);
  assert.equal(parsePositions(null).size, 0);
});

test('names typed by the user: accents, case, "Mount", numbers, codes, observatories', () => {
  assert.equal(normalizeName('Kīlauea'), 'kilauea');
  const names = (queries) => resolveQueries(queries, volcanoes).matched.map((v) => v.name);
  assert.deepEqual(names(['KĪLAUEA']), ['Kilauea']);
  assert.deepEqual(names(['St. Helens', 'mt rainier', 'Mount Baker']), [
    'Mount St. Helens',
    'Mount Rainier',
    'Mount Baker',
  ]);
  assert.deepEqual(names(['332010', 'hi3']), ['Kilauea']);
  assert.deepEqual(names(['yvo']), ['Yellowstone']);
  assert.equal(names(['avo']).length, 36);
  // A part of one name only.
  assert.deepEqual(names(['shasta']), ['Mount Shasta']);
  const { matched, unknown } = resolveQueries(['Etna', 'Sitkin', 'mount', 'ab'], volcanoes);
  assert.deepEqual(matched, []);
  assert.deepEqual(unknown, ['Etna', 'Sitkin', 'mount', 'ab']);
});

test('HTTP errors name the host and the status, never more', async () => {
  const answer = (status, text) => async () => ({ status, text: async () => text });
  await assert.rejects(fetchMonitored(answer(503, 'down')), {
    name: 'HttpError',
    message: 'volcanoes.usgs.gov: HTTP 503',
    status: 503,
  });
  await assert.rejects(fetchMonitored(answer(200, '<html>')), {
    message: 'volcanoes.usgs.gov: the answer is not JSON',
  });
  await assert.rejects(fetchMonitored(answer(200, '{}')), {
    message: 'volcanoes.usgs.gov: unexpected answer',
  });
  await assert.rejects(
    getJson(async () => {
      throw new TypeError('fetch failed');
    }, 'https://volcanoes.usgs.gov/x'),
    new HttpError('volcanoes.usgs.gov: fetch failed'),
  );
});
