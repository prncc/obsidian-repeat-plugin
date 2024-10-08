import { DateTime } from 'luxon';
import { parseYaml } from 'obsidian';

import { determineFrontmatterBounds } from '../frontmatter';

import {
  PeriodUnit,
  Repeat,
  Repetition,
  Strategy,
  TimeOfDay,
} from './repeatTypes';
import { DEFAULT_SETTINGS } from 'src/settings';

const joinedUnits = 'hour|day|week|month|year';

function parseRepeatPeriodUnit(unitDescription: string): PeriodUnit {
  const processedUnitDescription = unitDescription.trim();
  switch (processedUnitDescription) {
    case 'daily':
      return 'DAY';
    case 'weekly':
      return 'WEEK';
    case 'monthly':
      return 'MONTH';
    case 'yearly':
    case 'annually':
      return 'YEAR';
    default:
      break;
  }
  const unitRegex = new RegExp(
    `every (\\d+ )?(?<unit>${joinedUnits})s?`
  );
  let result;
  if (( result = unitRegex.exec(processedUnitDescription) )) {
    switch ((result?.groups?.unit || '').trim()) {
      case 'hour':
        return 'HOUR';
      case 'day':
        return 'DAY';
      case 'week':
        return 'WEEK';
      case 'month':
        return 'MONTH';
      case 'year':
        return 'YEAR';
      default:
        break;
    }
  }
  return 'DAY';
}

function parseRepeatTimeOfDay(timeOfDaySuffix: string): TimeOfDay {
  const processedTimeOfDaySuffix = timeOfDaySuffix.trim();
  if (processedTimeOfDaySuffix === 'in the evening' || processedTimeOfDaySuffix === 'pm') {
    return 'PM';
  }
  return 'AM';
}

export function parseRepeat(repeat: string): Repeat {
  let processedRepeat = repeat.toLowerCase();
  // First handle the 'spaced' prefix.
  let repeatStrategy = 'PERIODIC';
  const spacedRegex = /^spaced ?/;
  if (processedRepeat.match(spacedRegex)) {
    repeatStrategy = 'SPACED';
    processedRepeat = processedRepeat.split(spacedRegex)[1];
  }
  // Then parse everything else.
  const repetitionRegex = new RegExp(
    '(?<description>' +
      'daily|weekly|monthly|yearly|annually' +
      '|(' +
        `(every (${joinedUnits})|every (?<period>\\d+) (${joinedUnits})s?)` +
      ')' +
    ')' +
    '(?<timeOfDaySuffix>.*)'
  );
  let result;
  if (( result = repetitionRegex.exec(processedRepeat) )) {
    return {
      repeatStrategy: repeatStrategy as Strategy,
      repeatPeriod: parseInt(
        result?.groups?.period
        || String(DEFAULT_SETTINGS.defaultRepeat.repeatPeriod)
      ),
      repeatPeriodUnit: parseRepeatPeriodUnit(
        result?.groups?.description
        || DEFAULT_SETTINGS.defaultRepeat.repeatPeriodUnit
      ),
      repeatTimeOfDay: parseRepeatTimeOfDay(
        result?.groups?.timeOfDaySuffix
        || DEFAULT_SETTINGS.defaultRepeat.repeatTimeOfDay
      ),
    }
  }
  return DEFAULT_SETTINGS.defaultRepeat;
}

export function isRepeatDisabled(repeatFieldValue: string): boolean {
  // https://yaml.org/type/bool.html + "never"
  const booleanRegex = new RegExp('^(n|no|false|off|never)$', 'i');
  return booleanRegex.test(repeatFieldValue);
}

export function parseRepeatDueAt(
  repeatDueAt: string | undefined,
  repeat: Repeat | undefined,
  referenceDateTime: DateTime,
) {
  if (repeatDueAt) {
    const parsedDueAtMaybe = DateTime.fromISO(repeatDueAt);
    // @ts-ignore: luxon adds .invalid if the timestamp is not parsable.
    if (!parsedDueAtMaybe.invalid) {
      return parsedDueAtMaybe;
    }
  }
  // We can't parse the timestamp, or it isn't set.
  if (repeat) {
    return referenceDateTime.plus({
      [repeat.repeatPeriodUnit]: repeat.repeatPeriod,
    });
  }
  return referenceDateTime;
}

export function parseYamlBoolean(
  value: string | undefined,
): boolean {
  if (!value) {
    return false;
  }
  // Reference https://yaml.org/type/bool.html
  const booleanRegex = new RegExp('^(y|yes|true|on)$');
  return booleanRegex.test(value);
}

export function parseRepetitionFields(
  repeat: string,
  repeatDueAt: string | undefined,
  hidden?: string | undefined,
  referenceDateTime?: DateTime | undefined,
): Repetition {
  const parsedRepeat = parseRepeat(repeat);
  return {
    ...parsedRepeat,
    hidden: parseYamlBoolean(hidden),
    repeatDueAt: parseRepeatDueAt(
      repeatDueAt,
      parsedRepeat,
      referenceDateTime || DateTime.now(),
    ),
  }
}

export function parseRepetitionFromMarkdown(
  markdown: string,
): Repetition | undefined {
  const bounds = determineFrontmatterBounds(markdown);
  if (bounds) {
    const { repeat, due_at, hidden } = parseYaml(markdown.slice(...bounds)) || {};
    if (repeat && !isRepeatDisabled(repeat)) {
      return parseRepetitionFields(repeat, due_at || undefined, hidden);
    }
  }
  return undefined;
}

export function parseHiddenFieldFromMarkdown(
  markdown: string
): boolean {
  const frontmatterBounds = determineFrontmatterBounds(markdown);
  const frontmatter = frontmatterBounds?.length ?
    markdown.slice(...frontmatterBounds) : '';
  if (frontmatter) {
    const { hidden: extractedHidden } = parseYaml(frontmatter);
    return parseYamlBoolean(extractedHidden);
  }
  return false;
}

export function parseTime(twentyFourHourTime: string) {
  const [hourString, minuteString] = twentyFourHourTime.split(':');
  return {
    hour: parseInt(hourString),
    minute: parseInt(minuteString),
  };
}
