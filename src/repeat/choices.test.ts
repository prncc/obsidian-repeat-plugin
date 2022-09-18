import { DateTime } from 'luxon';
import { Repetition } from './repeatTypes';
import {
  getRepeatChoices,
  AM_REVIEW_TIME,
  PM_REVIEW_TIME,
} from './choices';

const dueAt = DateTime.fromObject({
  year: 2020,
  month: 1,
  day: 1,
});

const periodicRepetition = {
  repeatStrategy: 'PERIODIC',
  repeatPeriod: 1,
  repeatPeriodUnit: 'DAY',
  repeatTimeOfDay: 'AM',
  repeatDueAt: dueAt,
} as Repetition;

const spacedRepetition = {
  repeatStrategy: 'SPACED',
  repeatPeriod: 1,
  repeatPeriodUnit: 'HOUR',
  repeatDueAt: dueAt,
} as Repetition;

const invalidRepetition = {
  repeatStrategy: 'NONE',
  repeatDueAt: dueAt,
};

test.concurrent.each([
  ...['HOUR', 'DAY', 'MONTH', 'YEAR'].map((repeatPeriodUnit) => ({
    ...periodicRepetition,
    repeatPeriodUnit,
  })),
  {
    ...periodicRepetition,
    repeatDueAt: null,
  },
])('test periodic choice generation for unit $repeatPeriodUnit', (repetition: Repetition) => {
  const now = DateTime.now(); // TODO: Use a fixed value for now.
  const choices = getRepeatChoices(repetition);
  if (repetition.repeatDueAt === null) {
    expect(choices).toHaveLength(1);
    expect(choices[0]).toStrictEqual({
      id: 'dismiss',
      text: 'Dismiss',
      repeatDueAt: null,
    });
    return;
  }
  expect(choices).toHaveLength(2);
  choices.forEach((choice) => {
    expect(choice.repeatDueAt).not.toBeNull();
    // @ts-ignore
    expect(choice.repeatDueAt > now).toBe(true);
    if (!choice.text.includes('Skip')) {
      // @ts-ignore
      expect(choice.repeatDueAt.hour).toBe(
        (repetition.repeatTimeOfDay === 'AM') ? AM_REVIEW_TIME : PM_REVIEW_TIME,
      );
    }
  });
});

test.concurrent.each([
  ...['HOUR', 'DAY', 'MONTH', 'YEAR'].map((repeatPeriodUnit) => ({
    ...spacedRepetition,
    repeatPeriodUnit,
  })),
  {
    ...spacedRepetition,
    repeatDueAt: null,
  },
])('test spaced choice generation for unit $repeatPeriodUnit', (repetition: Repetition) => {
  const now = DateTime.now(); // TODO: Use a fixed value for now.
  const choices = getRepeatChoices(repetition);
  if (repetition.repeatDueAt === null) {
    expect(choices).toHaveLength(1);
    expect(choices[0]).toStrictEqual({
      id: 'dismiss',
      text: 'Dismiss',
      repeatDueAt: null,
    });
    return;
  }
  expect(choices).toHaveLength(5);
  choices.forEach((choice) => {
    expect(choice.repeatDueAt).not.toBeNull();
    // @ts-ignore
    expect(choice.repeatDueAt > now).toBe(true);
    expect(choice.repeatPeriodUnit).toBe('HOUR');
  });
});

test('a note with invalid repetition gets only a skip choice', () => {
  const choices = getRepeatChoices(invalidRepetition as Repetition);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toStrictEqual({
    id: 'dismiss',
    text: 'Dismiss',
    repeatDueAt: null,
  });
});
