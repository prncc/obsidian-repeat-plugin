import { PeriodUnit, Repeat, Repetition } from './repeatTypes';

const SERIALIZED_TRUE = 'true';
export const SERIALIZED_FALSE = 'false';

function serializeRepeatPeriodUnit(
  repeatPeriodUnit: PeriodUnit,
  repeatPeriod: number,
): string {
  const suffix = (repeatPeriod === 1) ? '' : 's';
  return `${repeatPeriodUnit.toLowerCase()}${suffix}`;
}

export function serializeRepeat({
  repeatStrategy,
  repeatPeriod,
  repeatPeriodUnit,
  repeatTimeOfDay,
  repeatWeekdays
}: Repeat | Repetition): string {
  // Handle weekday-based repetitions
  if (repeatPeriodUnit === 'WEEKDAYS' && repeatWeekdays && repeatWeekdays.length > 0) {
    const weekdayString = repeatWeekdays.join(', ');
    return [
      ...(repeatStrategy === 'PERIODIC' ? [] : ['spaced']),
      'every',
      weekdayString,
      ...(repeatTimeOfDay === 'AM' ? [] : ['in the evening']),
    ].join(' ');
  }

  // Handle traditional short forms
  if (repeatStrategy === 'PERIODIC'
      && repeatPeriod === 1
      && repeatPeriodUnit !== 'HOUR'
      && repeatTimeOfDay === 'AM'
  ) {
    switch (repeatPeriodUnit) {
      case 'DAY':
        return 'daily';
      case 'WEEK':
        return 'weekly';
      case 'MONTH':
        return 'monthly';
      case 'YEAR':
        return 'yearly';
      default:
        break;
    }
  }

  // Handle traditional time-based repetitions
  return [
    ...(repeatStrategy === 'PERIODIC' ? [] : ['spaced']),
    'every',
    ...(repeatPeriod === 1 ? [] : [`${repeatPeriod}`]),
    serializeRepeatPeriodUnit(repeatPeriodUnit, repeatPeriod),
    ...(repeatTimeOfDay === 'AM' ? [] : ['in the evening']),
  ].join(' ');
}

export function serializeRepetition(repetition: Repetition | 'DISMISS' | 'NEVER') {
  if (repetition === 'NEVER') {
    return {
      repeat: 'never',
      due_at: undefined,
      hidden: undefined,
    }
  } else if (repetition === 'DISMISS') {
    return {
      repeat: undefined,
      due_at: undefined,
      hidden: undefined,
    }
  } else {
    return {
      repeat: serializeRepeat(repetition),
      due_at: repetition.repeatDueAt.toISO(),
      hidden: repetition.hidden ? SERIALIZED_TRUE : SERIALIZED_FALSE,
    }
  }
}
