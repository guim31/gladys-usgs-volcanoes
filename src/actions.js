// -----------------------------------------------------------------------------
// The scene action `read_volcanoes` and the configuration action `check_now`.
// Both read HANS again when the last cycle is older than one interval, and
// answer with the followed volcanoes (and the nearby ones above normal) as one
// sentence: something a scene can send by message or read aloud, most active
// first.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES, LEVELS, levelRank } from './config.js';
import { PHRASES, STATUS, formatTime, render } from './messages.js';

const logger = createLogger({ name: 'usgs-volcanoes-actions' });

export const SCENE_ACTION = 'read_volcanoes';
export const CONFIG_ACTION = 'check_now';

/** The highest alert level of the volcanoes as its stable key, `none` without any. */
export function highestLevel(volcanoes) {
  const rank = Math.max(-1, ...volcanoes.map((volcano) => levelRank(volcano.level)));
  return LEVELS.find((level) => level.rank === rank)?.key ?? 'none';
}

/** Scene action: outputs `text`, `max_level` and `elevated_count`; throws if HANS never answered. */
export async function readVolcanoes(monitor) {
  const { volcanoes, ok } = await monitor.fresh();
  const language = monitor.config.language;
  if (!ok) {
    throw new Error(render(STATUS, 'hansDown')[language]);
  }
  return {
    text: monitor.sentence(language),
    max_level: highestLevel(volcanoes),
    elevated_count: volcanoes.filter((volcano) => levelRank(volcano.level) > 0).length,
  };
}

/** Configuration action: the volcanoes now, in every language. */
export async function checkNow(monitor) {
  const { volcanoes, ok } = await monitor.fresh();
  logger.info(
    `Check requested: ${ok ? `${volcanoes.length} volcano(es) listed` : 'HANS unreachable'}`,
  );
  if (!ok) {
    return render(STATUS, 'hansDown');
  }
  const unknown = monitor.unknown.join(', ');
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const text = render(STATUS, 'summary', {
        text: monitor.sentence(language),
        time: formatTime(monitor.lastSuccessAt, language),
      })[language];
      return [
        language,
        unknown ? `${text} ${PHRASES[language].unknown({ values: unknown })}` : text,
      ];
    }),
  );
}
