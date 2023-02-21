import { PeriodUnit, Repetition } from './repeatTypes';

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
    ...(repeatTimeOfDay === 'AM' ? [] : ['in the evening']),
  ].join(' ');
}

export function serializeRepetition(repetition: Repetition) {
  return {
    repeat: serializeRepeat(repetition),
    due_at: repetition.repeatDueAt.toISO(),
    hidden: repetition.hidden ? 'true' : 'false',
  }
}
