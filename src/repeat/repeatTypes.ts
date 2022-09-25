import { DateTime } from 'luxon';

export type Strategy = 'SPACED' | 'PERIODIC';

export type PeriodUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type TimeOfDay = 'AM' | 'PM';

export type Repeat = {
  repeatStrategy: Strategy,
  repeatPeriod: number,
  repeatPeriodUnit: PeriodUnit,
  repeatTimeOfDay: TimeOfDay,
}

export interface Repetition extends Repeat {
  repeatDueAt: DateTime,
}

export type RepeatChoice = {
  text: string,
  nextRepetition: Repetition | null,
}
