// -----------------------------------------------------------------------------
// The Gladys devices of the integration:
//
//   - one per followed volcano, platform id = its Smithsonian volcano number
//     (VNUM, stable, given by HANS):
//       alert_level   risk/integer 0 normal, 1 advisory, 2 watch, 3 warning;
//       aviation_color risk/integer 0 green, 1 yellow, 2 orange, 3 red;
//       latest_notice text/text: type and date of the newest USGS notice,
//                     and its synopsis when HANS gives one;
//   - "nearby volcanoes" (platform id `area`, one per Gladys), when a radius
//     is set:
//       highest_level  risk/integer: the highest alert level in the radius;
//       elevated_count counter-sensor/integer: volcanoes above normal;
//       highest_volcano text/text: the volcano concerned, its level, its
//                     distance.
//
// The two risk/integer features of a volcano share a couple: the dashboard
// then shows their published names. Published with should_poll: false: the
// refresh runs in the container (src/monitor.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';

export const VOLCANO_TYPE = 'volcano';
export const NEARBY_TYPE = 'nearby';
export const NEARBY_PLATFORM_ID = 'area';

export const MAX_COUNT = 1000;

// Feature and device names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    volcano: 'Volcano',
    nearby: 'Nearby volcanoes',
    alert_level: 'Volcano alert level',
    aviation_color: 'Aviation color code',
    latest_notice: 'Latest USGS notice',
    highest_level: 'Highest alert level',
    elevated_count: 'Volcanoes above normal',
    highest_volcano: 'Most active volcano',
  },
  fr: {
    volcano: 'Volcan',
    nearby: 'Volcans proches',
    alert_level: "Niveau d'alerte volcanique",
    aviation_color: 'Code couleur aviation',
    latest_notice: 'Dernier bulletin USGS',
    highest_level: "Niveau d'alerte le plus haut",
    elevated_count: 'Volcans au-dessus de la normale',
    highest_volcano: 'Volcan le plus actif',
  },
  de: {
    volcano: 'Vulkan',
    nearby: 'Vulkane in der Nähe',
    alert_level: 'Vulkan-Warnstufe',
    aviation_color: 'Luftfahrt-Farbcode',
    latest_notice: 'Neueste USGS-Meldung',
    highest_level: 'Höchste Warnstufe',
    elevated_count: 'Vulkane über normal',
    highest_volcano: 'Aktivster Vulkan',
  },
  es: {
    volcano: 'Volcán',
    nearby: 'Volcanes cercanos',
    alert_level: 'Nivel de alerta volcánica',
    aviation_color: 'Código de color de aviación',
    latest_notice: 'Último boletín del USGS',
    highest_level: 'Nivel de alerta más alto',
    elevated_count: 'Volcanes por encima de lo normal',
    highest_volcano: 'Volcán más activo',
  },
};

const namesOf = (language) => NAMES[language] ?? NAMES.fr;

/** External ids of a volcano device and of its features. */
export function volcanoIds(gladys, vnum) {
  const ids = gladys.externalIds(VOLCANO_TYPE, vnum);
  return {
    device: ids.device,
    level: ids.feature('alert_level'),
    color: ids.feature('aviation_color'),
    notice: ids.feature('latest_notice'),
  };
}

/** External ids of the nearby device and of its features. */
export function nearbyIds(gladys) {
  const ids = gladys.externalIds(NEARBY_TYPE, NEARBY_PLATFORM_ID);
  return {
    device: ids.device,
    level: ids.feature('highest_level'),
    count: ids.feature('elevated_count'),
    volcano: ids.feature('highest_volcano'),
  };
}

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

const risk = (name, externalId) =>
  sensor(name, externalId, DEVICE_FEATURE_CATEGORIES.RISK, TYPES.RISK.INTEGER, {
    keep_history: true,
    min: 0,
    max: 3,
  });

const text = (name, externalId) =>
  sensor(name, externalId, DEVICE_FEATURE_CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
    keep_history: false,
    min: 0,
    max: 0,
  });

/** The discovery payload of one volcano. */
export function buildVolcanoDevice(gladys, volcano, language = 'fr') {
  const ids = volcanoIds(gladys, volcano.vnum);
  const names = namesOf(language);
  return {
    name: `${names.volcano} ${volcano.name}`,
    external_id: ids.device,
    model: `USGS ${volcano.observatory.toUpperCase()}`,
    should_poll: false,
    params: [{ name: 'vnum', value: volcano.vnum }],
    features: [
      risk(names.alert_level, ids.level),
      risk(names.aviation_color, ids.color),
      text(names.latest_notice, ids.notice),
    ],
  };
}

/** The discovery payload of the nearby device. */
export function buildNearbyDevice(gladys, language = 'fr') {
  const ids = nearbyIds(gladys);
  const names = namesOf(language);
  return {
    name: names.nearby,
    external_id: ids.device,
    model: 'USGS',
    should_poll: false,
    params: [],
    features: [
      risk(names.highest_level, ids.level),
      sensor(
        names.elevated_count,
        ids.count,
        DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        TYPES.SENSOR.INTEGER,
        { keep_history: true, min: 0, max: MAX_COUNT },
      ),
      text(names.highest_volcano, ids.volcano),
    ],
  };
}
