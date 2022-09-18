import { DateTime } from 'luxon';

export type Strategy = 'SPACED' | 'PERIODIC';

export type PeriodUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type TimeOfDay = 'AM' | 'PM';

export type Repetition = {
  repeatStrategy: Strategy,
  repeatPeriod: number,
  repeatPeriodUnit: PeriodUnit,
  repeatTimeOfDay: TimeOfDay,
  repeatDueAt: DateTime,
}

export type RepeatChoice = {
  id: string,
  text: string,
  repeatDueAt: DateTime | null,
  repeatPeriod?: number,
  repeatPeriodUnit?: PeriodUnit,
}
