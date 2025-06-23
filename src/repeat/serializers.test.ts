jest.mock('obsidian', () => {}, { virtual: true });
import { parseRepetitionFields } from './parsers';
import { serializeRepetition } from './serializers';
import { DateTime } from 'luxon';

const referenceRepeatDueAt = DateTime.fromISO('2022-03-04T06:00:00.000-05:00');

const makeTestRepetitions = () => {
  const basicRepetitions = [
    'DAY',
    'WEEK',
    'MONTH',
    'YEAR',
  ].map((repeatPeriodUnit) => ({
    repeatStrategy: 'PERIODIC',
    repeatPeriod: 1,
    repeatPeriodUnit: repeatPeriodUnit,
    repeatTimeOfDay: 'AM',
    repeatDueAt: referenceRepeatDueAt,
    hidden: false,
    virtual: false,
  }));
  return [
    ...basicRepetitions,
    ...basicRepetitions.map((repetition) => ({
      ...repetition,
      repeatStrategy: 'SPACED',
      repeatPeriodUnit: 'HOUR',
    })),
    ...basicRepetitions.map((repetition) => ({
      ...repetition,
      repeatPeriod: 10,
    })),
    ...basicRepetitions.map((repetition) => ({
      ...repetition,
      repeatPeriod: 10,
      repeatStrategy: 'SPACED',
      repeatPeriodUnit: 'HOUR',
    })),
    // PM only applies to periodic notes.
    ...basicRepetitions.map((repetition) => ({
      ...repetition,
      repeatTimeOfDay: 'PM',
    })),
    // Hidden is true.
    ...basicRepetitions.map((repetition) => ({
      ...repetition,
      hidden: true,
    })),
  ];
};

describe('serializeRepeat round trip', () => {
  test.concurrent.each(
    makeTestRepetitions()
  )(
    'retains $repeatStrategy, $repeatPeriod, $repeatPeriodUnit, $repeatTimeOfDay',
    (repetition) => {
      const { repeat, due_at, hidden } = serializeRepetition(repetition as any);
      const serializedUnserializedRepetition = parseRepetitionFields(String(repeat), String(due_at ?? ""), String(hidden), undefined);
      expect(serializedUnserializedRepetition).toEqual(repetition);
    });
});

describe('serializeRepeat weekday round trip', () => {
  const weekdayRepetitions = [
    {
      repeatStrategy: 'PERIODIC',
      repeatPeriod: 1,
      repeatPeriodUnit: 'WEEKDAYS',
      repeatTimeOfDay: 'AM',
      repeatWeekdays: ['tuesday'],
      repeatDueAt: referenceRepeatDueAt,
      hidden: false,
      virtual: false,
    },
    {
      repeatStrategy: 'PERIODIC',
      repeatPeriod: 1,
      repeatPeriodUnit: 'WEEKDAYS',
      repeatTimeOfDay: 'PM',
      repeatWeekdays: ['monday', 'friday'],
      repeatDueAt: referenceRepeatDueAt,
      hidden: false,
      virtual: false,
    },
    {
      repeatStrategy: 'SPACED',
      repeatPeriod: 1,
      repeatPeriodUnit: 'WEEKDAYS',
      repeatTimeOfDay: 'AM',
      repeatWeekdays: ['wednesday', 'thursday'],
      repeatDueAt: referenceRepeatDueAt,
      hidden: true,
      virtual: false,
    },
  ];

  test.concurrent.each(weekdayRepetitions)(
    'retains weekday repetition $repeatWeekdays with $repeatTimeOfDay and $repeatStrategy',
    (repetition) => {
      const { repeat, due_at, hidden } = serializeRepetition(repetition as any);
      const serializedUnserializedRepetition = parseRepetitionFields(String(repeat), String(due_at ?? ""), String(hidden), undefined);
      expect(serializedUnserializedRepetition).toEqual(repetition);
    });
});
