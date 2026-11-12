// -----------------------------------------------------------------------------
// The `volcanoes` widget and the two actions: contents within the core budget
// (validateWidgetContent: an empty array means rendered as sent), the order,
// the names given in Gladys, the settings, and the sentences.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { MAX_ITEMS } from '../src/widgets.js';
import { RAINIER, createAll, createApi, createWorld, discovered } from './helpers/world.js';

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

const content = async (w, language, settings = {}) =>
  (await w.fake.widgetGet('volcanoes', { settings, language })).data.content;
const list = (widget) => widget.components.find((c) => c.type === 'card-list');

test('the widget lists the volcanoes, most active first, within the budget', async (t) => {
  const w = await world(t, { volcanoes: 'Mount Rainier, Kilauea, Great Sitkin' });
  for (const language of LANGUAGES) {
    const widget = await content(w, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    assert.deepEqual(
      list(widget).items.map((item) => item.title),
      ['Great Sitkin', 'Kilauea', 'Mount Rainier'],
    );
  }
  const en = await content(w, 'en');
  assert.equal(en.components[0].text, '2 volcanoes above normal');
  const [sitkin, kilauea, rainier] = list(en).items;
  assert.deepEqual(sitkin.badge, { text: 'Watch', color: 'warning' });
  assert.deepEqual(kilauea.badge, { text: 'Advisory', color: 'info' });
  assert.deepEqual(rainier.badge, { text: 'Normal', color: 'success' });
  assert.equal(kilauea.subtitle, 'Aviation yellow · HVO · 4,317 km');
  assert.match(kilauea.description, /^Daily update, 11\/11\/2026\nThe Halema'uma'u eruption/);
  assert.deepEqual(
    kilauea.links.map((link) => link.label),
    ['USGS notice', 'Volcano page'],
  );
  assert.equal(en.components.at(-1).link.url, 'https://volcanoes.usgs.gov/hans-public/');
  const fr = await content(w, 'fr');
  assert.equal(fr.components[0].text, '2 volcans au-dessus de la normale');
  assert.match(list(fr).items[1].subtitle, /^Code aviation jaune · HVO · 4\s317 km$/u);
});

test('nearby volcanoes are listed only above normal; the settings hide rows and the link', async (t) => {
  const api = createApi();
  api.setLevel(RAINIER, 'ADVISORY', 'YELLOW');
  const w = await world(t, { volcanoes: 'Mount Baker', radius: '200' }, { api });
  const widget = await content(w, 'en');
  assert.deepEqual(
    list(widget).items.map((item) => item.title),
    ['Mount Rainier', 'Mount Baker'],
  );
  const only = await content(w, 'en', { only_elevated: true, show_link: false });
  assert.deepEqual(
    list(only).items.map((item) => item.title),
    ['Mount Rainier'],
  );
  assert.ok(!only.components.some((c) => c.type === 'button'));
  assert.deepEqual(validateWidgetContent(only), []);
});

test('a created device shows the name given in Gladys; 8 rows at most', async (t) => {
  const w = await world(t, { volcanoes: 'avo', language: 'en' });
  const device = discovered(w).find((d) => d.name === 'Volcano Great Sitkin');
  await w.fake.deviceCreated({ ...device, name: 'Sitkin (Adak)' });
  const widget = await content(w, 'en');
  assert.equal(list(widget).items.length, MAX_ITEMS);
  assert.equal(list(widget).items[0].title, 'Sitkin (Adak)');
  assert.deepEqual(validateWidgetContent(widget), []);
});

test('before the first answer: waiting; nothing followed: said', async (t) => {
  const api = createApi();
  api.down = 503;
  const w = await world(t, {}, { api });
  assert.equal((await content(w, 'en')).components[0].text, 'Waiting for the USGS…');
  const empty = await world(t, { radius: '0' });
  assert.equal((await content(empty, 'en')).components[0].text, 'No volcano followed.');
});

test('scene action: the sentence, the highest level and the count above normal', async (t) => {
  const w = await world(t, { volcanoes: 'Kilauea, Mount Rainier', language: 'en' });
  const { data } = await w.fake.sceneAction('read_volcanoes', {});
  assert.deepEqual(data.outputs, {
    text: '1 volcano above normal: Kilauea: Advisory / Yellow, 4,317 km; Mount Rainier: Normal / Green, 94 km.',
    max_level: 'advisory',
    elevated_count: 1,
  });
  const api = createApi();
  api.down = 'network';
  const down = await world(t, {}, { api });
  const result = await down.fake.sceneAction('read_volcanoes', {});
  assert.equal(result.success, false);
});

test('configuration action: the levels in every language, and the names not found', async (t) => {
  const w = await world(t, { volcanoes: 'Kilauea, Etna' });
  const { data } = await w.fake.action('check_now', {});
  assert.equal(
    data.message.en,
    '1 volcano above normal: Kilauea: Advisory / Yellow, 4,317 km. Checked at 09:10. Not found or ambiguous: Etna.',
  );
  assert.match(data.message.fr, /^1 volcan au-dessus de la normale : Kilauea : Vigilance \/ Jaune/);
  assert.deepEqual(Object.keys(data.message), LANGUAGES);
  for (const language of LANGUAGES) {
    assert.ok(data.message[language].length <= 1000, language);
  }
});

test('a created device makes the widget refresh, a renamed one too', async (t) => {
  const w = await world(t, { volcanoes: 'Kilauea' });
  const before = w.fake.widgetRefreshes.length;
  // requestWidgetRefresh is throttled to one call every 10 s.
  w.clock.advance(20000);
  const [device] = await createAll(w);
  w.clock.advance(20000);
  await w.fake.deviceUpdated({ ...device, name: 'Kilauea (Big Island)' });
  assert.ok(w.fake.widgetRefreshes.length >= before + 2);
});
