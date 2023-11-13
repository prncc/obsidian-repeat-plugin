jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { RepeatChoice, Repetition } from './repeatTypes';
import {
  getRepeatChoices,
  DISMISS_BUTTON_TEXT,
  SKIP_BUTTON_TEXT,
} from './choices';
import { parseTime } from './parsers';

const mockPluginSettings = {
  morningReviewTime: '06:00',
  eveningReviewTime: '18:00',
};

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
  const choices = getRepeatChoices(repetition, mockPluginSettings as any);
  if (repetition.repeatDueAt === null) {
    expect(choices).toHaveLength(1);
    expect(choices[0]).toStrictEqual({
      text: DISMISS_BUTTON_TEXT,
      nextRepetition: null,
    } as RepeatChoice);
    return;
  }
  expect(choices).toHaveLength(2);
  choices.forEach((choice) => {
    expect(choice.nextRepetition?.repeatDueAt).not.toBeNull();
    // @ts-ignore
    expect(choice.nextRepetition?.repeatDueAt > now).toBe(true);
    if (choice.text !== SKIP_BUTTON_TEXT) {
      // @ts-ignore
      expect(choice.nextRepetition?.repeatDueAt.hour).toBe(
        (repetition.repeatTimeOfDay === 'AM')
          ? parseTime(mockPluginSettings.morningReviewTime).hour
          : parseTime(mockPluginSettings.eveningReviewTime).hour,
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
  const choices = getRepeatChoices(repetition, mockPluginSettings as any);
  if (repetition.repeatDueAt === null) {
    expect(choices).toHaveLength(1);
    expect(choices[0]).toStrictEqual({
      text: DISMISS_BUTTON_TEXT,
      nextRepetition: null,
    });
    return;
  }
  expect(choices).toHaveLength(5);
  choices.forEach((choice) => {
    expect(choice.nextRepetition).not.toBeNull();
    // @ts-ignore
    expect(choice.nextRepetition?.repeatDueAt > now).toBe(true);
    expect(choice.nextRepetition?.repeatPeriodUnit).toBe('HOUR');
  });
});

test('a note with invalid repetition gets only a skip choice', () => {
  const choices = getRepeatChoices(
    invalidRepetition as Repetition,
    mockPluginSettings as any);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toStrictEqual({
    text: DISMISS_BUTTON_TEXT,
    nextRepetition: null,
  });
});
