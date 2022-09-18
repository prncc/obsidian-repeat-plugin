import { DateTime } from 'luxon';

// TODO: Make this type stricter.
type Repetition = {
  repeatStrategy: string,
  repeatPeriod: number,
  repeatPeriodUnit: string,
  repeatTimeOfDay: string,
  repeatDueAt: string,
}

const joinedUnits = 'day|week|month|year';

export const DEFAULT_REPETITION: Repetition = {
  repeatStrategy: 'PERIODIC',
  repeatPeriod: 1,
  repeatPeriodUnit: 'DAY',
  repeatTimeOfDay: 'AM', // TODO: read from settings.
  repeatDueAt: DateTime.now().plus({ day: 1 }), // TODO: Do this in the repeat logic module.
}

function parseRepeatPeriodUnit(unitDescription: string): string {
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

function parseRepeatTimeOfDay(timeOfDayDescription: string): string {
  const processedTimeOfDaySuffix = timeOfDayDescription.trim();
  if (timeOfDayDescription === 'in the evening' || timeOfDayDescription === 'pm') {
    return 'PM';
  }
  return 'AM';
}

export function parseRepetitionFields(repeat: string, repeatDueAt: string) {
  let processedRepeat = repeat.toLowerCase();
  let repetitionRegex = new RegExp(
    '(?<unitAndPeriod>daily|weekly|monthly|yearly|annually' +
    `|every (${joinedUnits})|every (?<period>\\d+) (${joinedUnits})s?)` +
    '\\s?(?<timeOfDaySuffix>.*)'
  );
  let result;
  if (( result = repetitionRegex.exec(processedRepeat) )) {
    return {
      repeatStrategy: 'PERIODIC',
      repeatPeriod: parseInt(result?.groups?.period || '1'),
      repeatPeriodUnit: parseRepeatPeriodUnit(result?.groups?.unitAndPeriod || 'day'),
      repeatTimeOfDay: parseRepeatTimeOfDay(result?.groups?.timeOfDaySuffix || 'am'),
      repeatDueAt: DateTime.fromISO(repeatDueAt), // TODO recover if broken or missing
    }
  }
  return DEFAULT_REPETITION;
}
