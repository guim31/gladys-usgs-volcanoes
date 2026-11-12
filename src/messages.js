// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action and
// scene messages, scene variables), in the four languages of the Gladys
// interface. Entries are strings or functions of one parameter object. German
// says "du", Spanish "usted". Volcano names and USGS synopses are in English:
// they are not translated.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';

export const LEVEL_NAMES = {
  en: { normal: 'Normal', advisory: 'Advisory', watch: 'Watch', warning: 'Warning' },
  fr: { normal: 'Normal', advisory: 'Vigilance', watch: 'Veille', warning: 'Alerte' },
  de: { normal: 'Normal', advisory: 'Hinweis', watch: 'Beobachtung', warning: 'Warnung' },
  es: { normal: 'Normal', advisory: 'Aviso', watch: 'Vigilancia', warning: 'Alerta' },
};

export const COLOR_NAMES = {
  en: { green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red' },
  fr: { green: 'Vert', yellow: 'Jaune', orange: 'Orange', red: 'Rouge' },
  de: { green: 'Grün', yellow: 'Gelb', orange: 'Orange', red: 'Rot' },
  es: { green: 'Verde', yellow: 'Amarillo', orange: 'Naranja', red: 'Rojo' },
};

export const NOTICE_NAMES = {
  en: {
    DU: 'Daily update',
    WU: 'Weekly update',
    MU: 'Monthly update',
    IS: 'Information statement',
    VV: 'Activity notice',
    other: 'Notice',
  },
  fr: {
    DU: 'Bulletin quotidien',
    WU: 'Bulletin hebdomadaire',
    MU: 'Bulletin mensuel',
    IS: "Communiqué d'information",
    VV: "Avis d'activité",
    other: 'Bulletin',
  },
  de: {
    DU: 'Tägliche Meldung',
    WU: 'Wöchentliche Meldung',
    MU: 'Monatliche Meldung',
    IS: 'Informationsmeldung',
    VV: 'Aktivitätsmeldung',
    other: 'Meldung',
  },
  es: {
    DU: 'Boletín diario',
    WU: 'Boletín semanal',
    MU: 'Boletín mensual',
    IS: 'Comunicado informativo',
    VV: 'Aviso de actividad',
    other: 'Boletín',
  },
};

/** Colour of an alert level in the closed widget palette. */
export const LEVEL_COLORS = {
  normal: WIDGET_COLORS.SUCCESS,
  advisory: WIDGET_COLORS.INFO,
  watch: WIDGET_COLORS.WARNING,
  warning: WIDGET_COLORS.DANGER,
};

// Values of the text features, and pieces of sentences.
export const PHRASES = {
  en: {
    noNotice: 'No USGS notice yet',
    noneNearby: 'No volcano above normal nearby',
    level: ({ level, color }) => `${level} / ${color}`,
    item: ({ name, level }) => `${name}: ${level}`,
    away: ({ km }) => `${km} km`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `and ${count} more`,
    elevated: ({ count }) =>
      count === 0
        ? 'No volcano above normal'
        : count === 1
          ? '1 volcano above normal'
          : `${count} volcanoes above normal`,
    nothing: 'No volcano followed.',
    unknown: ({ values }) => `Not found or ambiguous: ${values}.`,
  },
  fr: {
    noNotice: 'Aucun bulletin USGS pour le moment',
    noneNearby: 'Aucun volcan au-dessus de la normale à proximité',
    level: ({ level, color }) => `${level} / ${color}`,
    item: ({ name, level }) => `${name} : ${level}`,
    away: ({ km }) => `à ${km} km`,
    list: ({ head, items }) => `${head} : ${items.join(' ; ')}.`,
    more: ({ count }) => `et ${count} de plus`,
    elevated: ({ count }) =>
      count === 0
        ? 'Aucun volcan au-dessus de la normale'
        : count === 1
          ? '1 volcan au-dessus de la normale'
          : `${count} volcans au-dessus de la normale`,
    nothing: 'Aucun volcan suivi.',
    unknown: ({ values }) => `Introuvable ou ambigu : ${values}.`,
  },
  de: {
    noNotice: 'Noch keine USGS-Meldung',
    noneNearby: 'Kein Vulkan über normal in der Nähe',
    level: ({ level, color }) => `${level} / ${color}`,
    item: ({ name, level }) => `${name}: ${level}`,
    away: ({ km }) => `${km} km entfernt`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `und ${count} weitere`,
    elevated: ({ count }) =>
      count === 0
        ? 'Kein Vulkan über normal'
        : count === 1
          ? '1 Vulkan über normal'
          : `${count} Vulkane über normal`,
    nothing: 'Kein Vulkan verfolgt.',
    unknown: ({ values }) => `Nicht gefunden oder mehrdeutig: ${values}.`,
  },
  es: {
    noNotice: 'Aún no hay boletín del USGS',
    noneNearby: 'Ningún volcán por encima de lo normal cerca',
    level: ({ level, color }) => `${level} / ${color}`,
    item: ({ name, level }) => `${name}: ${level}`,
    away: ({ km }) => `a ${km} km`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `y ${count} más`,
    elevated: ({ count }) =>
      count === 0
        ? 'Ningún volcán por encima de lo normal'
        : count === 1
          ? '1 volcán por encima de lo normal'
          : `${count} volcanes por encima de lo normal`,
    nothing: 'Ningún volcán seguido.',
    unknown: ({ values }) => `No encontrado o ambiguo: ${values}.`,
  },
};

// Connection status of the Configuration screen, and messages of the actions.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    hansDown: 'The USGS (HANS) does not answer: the alert levels are not updated.',
    nothing: 'No volcano followed: type volcano names or choose a radius.',
    noCenter:
      'No centre for the nearby volcanoes: give your house a location in Gladys (Settings, Houses) or type coordinates.',
    invalidCenter: 'The coordinates are not valid: the location of your house is used.',
    unknown: ({ values }) => `Not found among the monitored volcanoes, or ambiguous: ${values}.`,
    summary: ({ text, time }) => `${text} Checked at ${time}.`,
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    hansDown: "L'USGS (HANS) ne répond pas : les niveaux d'alerte ne sont pas mis à jour.",
    nothing: 'Aucun volcan suivi : saisissez des noms de volcans ou choisissez un rayon.',
    noCenter:
      'Aucun centre pour les volcans proches : indiquez la position de votre maison dans Gladys (Paramètres, Maisons) ou saisissez des coordonnées.',
    invalidCenter:
      'Les coordonnées ne sont pas valides : la position de votre maison est utilisée.',
    unknown: ({ values }) => `Introuvable parmi les volcans surveillés, ou ambigu : ${values}.`,
    summary: ({ text, time }) => `${text} Vérifié à ${time}.`,
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    hansDown: 'Der USGS (HANS) antwortet nicht: Die Warnstufen werden nicht aktualisiert.',
    nothing: 'Kein Vulkan verfolgt: Trage Vulkannamen ein oder wähle einen Radius.',
    noCenter:
      'Kein Mittelpunkt für die Vulkane in der Nähe: Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser) oder trage Koordinaten ein.',
    invalidCenter: 'Die Koordinaten sind ungültig: Der Standort deines Hauses wird verwendet.',
    unknown: ({ values }) =>
      `Nicht unter den überwachten Vulkanen gefunden oder mehrdeutig: ${values}.`,
    summary: ({ text, time }) => `${text} Geprüft um ${time}.`,
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    hansDown: 'El USGS (HANS) no responde: los niveles de alerta no se actualizan.',
    nothing: 'Ningún volcán seguido: introduzca nombres de volcanes o elija un radio.',
    noCenter:
      'Sin centro para los volcanes cercanos: indique la ubicación de su casa en Gladys (Ajustes, Casas) o introduzca coordenadas.',
    invalidCenter: 'Las coordenadas no son válidas: se usa la ubicación de su casa.',
    unknown: ({ values }) => `No encontrado entre los volcanes vigilados, o ambiguo: ${values}.`,
    summary: ({ text, time }) => `${text} Comprobado a las ${time}.`,
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const locale = (language) => (language === 'en' ? 'en-GB' : language);

/** A date in the user's time zone (TZ, set by the Gladys supervisor), e.g. "11/11 18:25". */
export function formatDate(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A day with its year, e.g. "11/11/2026": old notices date back years. */
export function formatDay(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(time));
}

/** A time of day, e.g. "18:35". */
export function formatTime(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A number in the user's language, e.g. "1 234". */
export function formatNumber(value, language) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: 0 }).format(value);
}

export const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** "Advisory / Yellow", in words. */
export function levelText(volcano, language) {
  return PHRASES[language].level({
    level: LEVEL_NAMES[language][volcano.level],
    color: COLOR_NAMES[language][volcano.color] ?? '?',
  });
}

/** "Daily update, 11/11/2026", or null without notice. */
export function noticeText(notice, language) {
  if (!notice) {
    return null;
  }
  const name = NOTICE_NAMES[language][notice.type] ?? NOTICE_NAMES[language].other;
  return notice.sentAt === null ? name : `${name}, ${formatDay(notice.sentAt, language)}`;
}

/** The value of the "Latest USGS notice" feature: type, date and synopsis. */
export function latestNoticeText(volcano, language) {
  const notice = noticeText(volcano.notice, language);
  if (!notice) {
    return PHRASES[language].noNotice;
  }
  return clip(volcano.synopsis ? `${notice}: ${volcano.synopsis}` : notice, 250);
}

const km = (distance, language) =>
  PHRASES[language].away({ km: formatNumber(Math.round(distance), language) });

/** "Kilauea: Advisory / Yellow, 120 km away" (the distance when known). */
export function describe(volcano, language, name = volcano.name) {
  const where = volcano.distanceKm === null ? '' : `, ${km(volcano.distanceKm, language)}`;
  return `${PHRASES[language].item({ name, level: levelText(volcano, language) })}${where}`;
}

// Volcanoes named in one sentence: a scene that reads it aloud stays short.
export const SENTENCE_VOLCANOES = 5;

/**
 * The volcanoes as one sentence, e.g. "1 volcano above normal: Kilauea:
 * Advisory / Yellow; Mount Rainier: Normal / Green." Sorted already.
 */
export function sentence(volcanoes, language) {
  const p = PHRASES[language];
  if (volcanoes.length === 0) {
    return p.nothing;
  }
  const count = volcanoes.filter((volcano) => volcano.level !== 'normal').length;
  const items = volcanoes
    .slice(0, SENTENCE_VOLCANOES)
    .map((volcano) => describe(volcano, language));
  const rest = volcanoes.length - SENTENCE_VOLCANOES;
  if (rest > 0) {
    items.push(p.more({ count: rest }));
  }
  return p.list({ head: p.elevated({ count }), items });
}
