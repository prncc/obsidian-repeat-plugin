import { DateTime } from 'luxon';

export type Strategy = 'SPACED' | 'PERIODIC';

export type PeriodUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type TimeOfDay = 'AM' | 'PM';

// A parsed `repeat` property value.
export type Repeat = {
  repeatStrategy: Strategy,
  repeatPeriod: number,
  repeatPeriodUnit: PeriodUnit,
  repeatTimeOfDay: TimeOfDay,
}

// A complete set of parsed repetition properties.
export interface Repetition extends Repeat {
  repeatDueAt: DateTime,
  hidden: boolean,
  virtual: boolean,
}

// A next-repeat choice shown in the review interface.
export type RepeatChoice = {
  text: string,
  nextRepetition: Repetition | null,
}
