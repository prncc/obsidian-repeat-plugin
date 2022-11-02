jest.mock('obsidian', () => {}, { virtual: true });
import { parseRepetitionFields } from "./parsers";
import { serializeRepetition } from "./serializers";
import { DateTime } from "luxon";

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
  ];
};

describe('serializeRepeat round trip', () => {
  test.concurrent.each(
    makeTestRepetitions()
  )(
    'retains $repeatStrategy, $repeatPeriod, $repeatPeriodUnit, $repeatTimeOfDay',
    (repetition) => {
      const { repeat, due_at } = serializeRepetition(repetition as any);
      const serializedUnserializedRepetition = parseRepetitionFields(repeat, due_at, undefined);
      expect(serializedUnserializedRepetition).toEqual(repetition);
    });
});
