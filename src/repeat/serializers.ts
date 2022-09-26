import { PeriodUnit, Repetition, Strategy, TimeOfDay } from './repeatTypes';

function getRepeatTimeOfDayParts(
  repeatTimeOfDay: TimeOfDay,
  repeatStrategy: Strategy,
): Array<string> {
  // Spaced repetition time of day is set dynamically,
  // and the default time of day is in the morning.
  if ((repeatTimeOfDay === 'AM') || (repeatStrategy === 'SPACED')) {
    return [];
  }
  return ['in the evening'];
}

function serializeRepeatPeriodUnit(
  repeatPeriodUnit: PeriodUnit,
  repeatPeriod: number,
): string {
  const suffix = (repeatPeriod === 1) ? '' : 's';
  return `${repeatPeriodUnit.toLowerCase()}${suffix}`;
}

function serializeRepeat({
  repeatStrategy,
  repeatPeriod,
  repeatPeriodUnit,
  repeatTimeOfDay

}: Repetition): string {
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
  return [
    ...(repeatStrategy === 'PERIODIC' ? [] : ['spaced']),
    'every',
    ...(repeatPeriod === 1 ? [] : [`${repeatPeriod}`]),
    serializeRepeatPeriodUnit(repeatPeriodUnit, repeatPeriod),
    ...getRepeatTimeOfDayParts(repeatTimeOfDay, repeatStrategy),
  ].join(' ');
}

export function serializeRepetition(repetition: Repetition) {
  return {
    repeat: serializeRepeat(repetition),
    repeat_due_at: repetition.repeatDueAt.toISO(),
  }
}
