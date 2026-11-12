// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `volcanoes`.
//
// A heading with the number of volcanoes above normal, then the followed
// volcanoes and the nearby ones above normal as a `card-list` (8 rows at most,
// the core's cap), most active first: the name as title (the one given in
// Gladys for a created device), the aviation colour, the observatory and the
// distance as subtitle, the alert level as a coloured badge. Tapping a row
// opens the core's detail panel: the newest notice, its synopsis, the date of
// the last level change when the integration saw it, and links to the notice
// and the volcano page. The footer gives the source and the time of the last
// reading, and a link to HANS (hidden by a setting).
// Settings: `only_elevated` (hide the volcanoes at normal), `show_link`.
// Budget: 2 texts, 1 card-list, 1 button.
// -----------------------------------------------------------------------------

import { levelRank } from './config.js';
import { HANS_SITE } from './hans.js';
import { volcanoIds } from './device.js';
import {
  COLOR_NAMES,
  LEVEL_COLORS,
  LEVEL_NAMES,
  PHRASES,
  clip,
  formatDate,
  formatNumber,
  noticeText,
} from './messages.js';
import { WIDGET_KEY } from './monitor.js';

export const MAX_ITEMS = 8;
export const TTL_SECONDS = 300;

export const TEXT = {
  waiting: {
    en: 'Waiting for the USGS…',
    fr: "En attente de l'USGS…",
    de: 'Warte auf den USGS…',
    es: 'Esperando al USGS…',
  },
  source: { en: 'Source: USGS', fr: 'Source : USGS', de: 'Quelle: USGS', es: 'Fuente: USGS' },
  notice: { en: 'USGS notice', fr: 'Bulletin USGS', de: 'USGS-Meldung', es: 'Boletín USGS' },
  page: {
    en: 'Volcano page',
    fr: 'Page du volcan',
    de: 'Vulkanseite',
    es: 'Página del volcán',
  },
  since: { en: 'Level since', fr: 'Niveau depuis le', de: 'Stufe seit', es: 'Nivel desde' },
  aviation: { en: 'Aviation', fr: 'Code aviation', de: 'Luftfahrt', es: 'Aviación' },
  site: { en: 'USGS HANS', fr: 'USGS HANS', de: 'USGS HANS', es: 'USGS HANS' },
};

const t = (text, language) => text[language] ?? text.en;
const truthy = (value, fallback) =>
  value === undefined || value === null ? fallback : value === true || value === 'true';

/** One row of the list, and its detail panel. */
export function itemOf(volcano, language, name = volcano.name) {
  const distance =
    volcano.distanceKm === null
      ? null
      : `${formatNumber(Math.round(volcano.distanceKm), language)} km`;
  const color = COLOR_NAMES[language][volcano.color];
  const notice = noticeText(volcano.notice, language);
  const links = [];
  if (volcano.notice?.url) {
    links.push({ url: volcano.notice.url, label: t(TEXT.notice, language) });
  }
  if (volcano.url) {
    links.push({ url: volcano.url, label: t(TEXT.page, language) });
  }
  return {
    title: clip(name, 60),
    subtitle: clip(
      [
        color ? `${t(TEXT.aviation, language)} ${color.toLowerCase()}` : null,
        volcano.observatory.toUpperCase(),
        distance,
      ]
        .filter(Boolean)
        .join(' · '),
      60,
    ),
    badge: volcano.level
      ? { text: LEVEL_NAMES[language][volcano.level], color: LEVEL_COLORS[volcano.level] }
      : undefined,
    // USGS writes its synopses in English: shown as they are.
    description: clip(
      [
        notice ?? PHRASES[language].noNotice,
        volcano.synopsis,
        volcano.changedAt
          ? `${t(TEXT.since, language)} ${formatDate(volcano.changedAt, language)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      2000,
    ),
    ...(links.length > 0 ? { links } : {}),
  };
}

/** The name given in Gladys to the device of a volcano, else the HANS name. */
function nameOf(monitor, volcano) {
  const id = volcanoIds(monitor.gladys, volcano.vnum).device;
  const device = (monitor.gladys.devices ?? []).find((d) => d.external_id === id);
  return device?.name || volcano.name;
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { language = 'en', settings = {} } = {}) {
      const lang = LEVEL_NAMES[language] ? language : 'en';
      const onlyElevated = truthy(settings.only_elevated, false);
      const showLink = truthy(settings.show_link, true);
      const updated = monitor.lastSuccessAt;
      const source = t(TEXT.source, lang);
      const shown = monitor.shown();
      const elevated = shown.filter((v) => levelRank(v.level) > 0);
      const listed = onlyElevated ? elevated : shown;
      const components = [
        {
          type: 'text',
          variant: 'heading',
          text:
            updated === null
              ? t(TEXT.waiting, lang)
              : shown.length === 0
                ? PHRASES[lang].nothing
                : PHRASES[lang].elevated({ count: elevated.length }),
        },
      ];
      if (listed.length > 0) {
        components.push({
          type: 'card-list',
          display: 'list',
          items: listed
            .slice(0, MAX_ITEMS)
            .map((volcano) => itemOf(volcano, lang, nameOf(monitor, volcano))),
        });
      }
      components.push({
        type: 'text',
        variant: 'caption',
        text: updated === null ? source : `${source} · ${formatDate(updated, lang)}`,
      });
      if (showLink) {
        components.push({
          type: 'button',
          label: t(TEXT.site, lang),
          icon: 'external-link',
          link: { url: HANS_SITE },
        });
      }
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
