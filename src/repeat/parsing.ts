import { DateTime } from 'luxon';

import { Repetition, Strategy, TimeOfDay, PeriodUnit } from './repeatTypes';

const joinedUnits = 'hour|day|week|month|year';

export function makeDefaultRepetition(
  repeatStrategy: string,
  repeatDueAt?: DateTime,
): Repetition {
  return {
    repeatStrategy: repeatStrategy as Strategy,
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY' as PeriodUnit,
    repeatTimeOfDay: 'AM' as TimeOfDay,
    repeatDueAt: repeatDueAt || DateTime.now().plus({ day: 1 }),
  };
}

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

export function parseRepetitionFields(
  repeat: string,
  repeatDueAt: string,
): Repetition {
  let processedRepeat = repeat.toLowerCase();
  let repetitionRegex = new RegExp(
    '(?<description>' +
      'daily|weekly|monthly|yearly|annually' +
      '|(' +
        '(?<spaced>spaced ?)?' +
        `(every (${joinedUnits})|every (?<period>\\d+) (${joinedUnits})s?)` +
      ')' +
    ')' +
    '(?<timeOfDaySuffix>.*)'
  );
  let result;
  if (( result = repetitionRegex.exec(processedRepeat) )) {
    return {
      repeatStrategy: (result?.groups?.spaced || '').trim() === 'spaced'
                      ? 'SPACED' : 'PERIODIC',
      repeatPeriod: parseInt(result?.groups?.period || '1'),
      repeatPeriodUnit: parseRepeatPeriodUnit(result?.groups?.description || 'day'),
      repeatTimeOfDay: parseRepeatTimeOfDay(result?.groups?.timeOfDaySuffix || 'am'),
      repeatDueAt: DateTime.fromISO(repeatDueAt), // TODO recover if broken
    }
  }
  // If here, repeat is not in a recognized format so we default to spaced.
  return makeDefaultRepetition('SPACED', DateTime.fromISO(repeatDueAt)); // TODO recover if date broken
}
