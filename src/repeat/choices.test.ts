jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { RepeatChoice, Repetition } from './repeatTypes';
import {
  getRepeatChoices,
  DISMISS_BUTTON_TEXT,
  SKIP_BUTTON_TEXT,
  NEVER_BUTTON_TEXT,
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
  hidden: false,
  virtual: false,
} as Repetition;

const spacedRepetition = {
  repeatStrategy: 'SPACED',
  repeatPeriod: 1,
  repeatPeriodUnit: 'HOUR',
  repeatDueAt: dueAt,
  hidden: false,
  virtual: false,
} as Repetition;

const virtualPeriodicRepetition = {
  ...periodicRepetition,
  virtual: true,
} as Repetition;

const virtualSpacedRepetition = {
  ...spacedRepetition,
  virtual: true,
} as Repetition;

const invalidRepetition = {
  repeatStrategy: 'NONE',
  repeatDueAt: dueAt,
  hidden: false,
  virtual: false,
};

// Helper function to check if nextRepetition is a Repetition object
function isRepetition(nextRepetition: Repetition | 'DISMISS' | 'NEVER'): nextRepetition is Repetition {
  return typeof nextRepetition === 'object' && nextRepetition !== null;
}

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
      nextRepetition: 'DISMISS',
    } as RepeatChoice);
    return;
  }
  expect(choices).toHaveLength(2);
  choices.forEach((choice) => {
    if (isRepetition(choice.nextRepetition)) {
      expect(choice.nextRepetition.repeatDueAt).not.toBeNull();
      expect(choice.nextRepetition.repeatDueAt > now).toBe(true);
      if (choice.text !== SKIP_BUTTON_TEXT) {
        expect(choice.nextRepetition.repeatDueAt.hour).toBe(
          (repetition.repeatTimeOfDay === 'AM')
            ? parseTime(mockPluginSettings.morningReviewTime).hour
            : parseTime(mockPluginSettings.eveningReviewTime).hour,
        );
      }
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
      nextRepetition: 'DISMISS',
    });
    return;
  }
  expect(choices).toHaveLength(5);

  // Skip button.
  const firstChoice = choices.shift();
  if (firstChoice && isRepetition(firstChoice.nextRepetition)) {
    expect(firstChoice.nextRepetition.repeatPeriodUnit).toBe(
      repetition.repeatPeriodUnit);
    expect(firstChoice.nextRepetition.repeatPeriod).toBe(
      repetition.repeatPeriod);
  }

  choices.forEach((choice) => {
    if (isRepetition(choice.nextRepetition)) {
      expect(choice.nextRepetition.repeatDueAt > now).toBe(true);
      expect(choice.nextRepetition.repeatPeriodUnit).toBe('HOUR');
    }
  });
});

test('a note with invalid repetition gets only a skip choice', () => {
  const choices = getRepeatChoices(
    invalidRepetition as Repetition,
    mockPluginSettings as any);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toStrictEqual({
    text: DISMISS_BUTTON_TEXT,
    nextRepetition: 'DISMISS',
  });
});

test('periodic repetition includes NEVER button when enqueueNonRepeatingNotes is true and virtual is true', () => {
  const settingsWithEnqueue = {
    ...mockPluginSettings,
    enqueueNonRepeatingNotes: true,
  };

  const choices = getRepeatChoices(virtualPeriodicRepetition, settingsWithEnqueue as any);

  // Should have 3 choices: skip, next repetition, and never
  expect(choices).toHaveLength(3);

  // Check that the NEVER button is present
  const neverChoice = choices.find(choice => choice.nextRepetition === 'NEVER');
  expect(neverChoice).toBeDefined();
  expect(neverChoice?.text).toBe(NEVER_BUTTON_TEXT);
});

test('spaced repetition includes NEVER button when enqueueNonRepeatingNotes is true and virtual is true', () => {
  const settingsWithEnqueue = {
    ...mockPluginSettings,
    enqueueNonRepeatingNotes: true,
  };

  const choices = getRepeatChoices(virtualSpacedRepetition, settingsWithEnqueue as any);

  // Should have 6 choices: skip, 4 multiplier choices, and never
  expect(choices).toHaveLength(6);

  // Check that the NEVER button is present
  const neverChoice = choices.find(choice => choice.nextRepetition === 'NEVER');
  expect(neverChoice).toBeDefined();
  expect(neverChoice?.text).toBe(NEVER_BUTTON_TEXT);
});

test('periodic repetition excludes NEVER button when enqueueNonRepeatingNotes is false', () => {
  const settingsWithoutEnqueue = {
    ...mockPluginSettings,
    enqueueNonRepeatingNotes: false,
  };

  const choices = getRepeatChoices(virtualPeriodicRepetition, settingsWithoutEnqueue as any);

  // Should have 2 choices: skip and next repetition (no never)
  expect(choices).toHaveLength(2);

  // Check that the NEVER button is not present
  const neverChoice = choices.find(choice => choice.nextRepetition === 'NEVER');
  expect(neverChoice).toBeUndefined();
});

test('spaced repetition excludes NEVER button when enqueueNonRepeatingNotes is false', () => {
  const settingsWithoutEnqueue = {
    ...mockPluginSettings,
    enqueueNonRepeatingNotes: false,
  };

  const choices = getRepeatChoices(virtualSpacedRepetition, settingsWithoutEnqueue as any);

  // Should have 5 choices: skip and 4 multiplier choices (no never)
  expect(choices).toHaveLength(5);

  // Check that the NEVER button is not present
  const neverChoice = choices.find(choice => choice.nextRepetition === 'NEVER');
  expect(neverChoice).toBeUndefined();
});

test('periodic repetition excludes NEVER button when virtual is false even if enqueueNonRepeatingNotes is true', () => {
  const settingsWithEnqueue = {
    ...mockPluginSettings,
    enqueueNonRepeatingNotes: true,
  };

  const choices = getRepeatChoices(periodicRepetition, settingsWithEnqueue as any);

  // Should have 2 choices: skip and next repetition (no never)
  expect(choices).toHaveLength(2);

  // Check that the NEVER button is not present
  const neverChoice = choices.find(choice => choice.nextRepetition === 'NEVER');
  expect(neverChoice).toBeUndefined();
});

test('spaced repetition excludes NEVER button when virtual is false even if enqueueNonRepeatingNotes is true', () => {
  const settingsWithEnqueue = {
    ...mockPluginSettings,
    enqueueNonRepeatingNotes: true,
  };

  const choices = getRepeatChoices(spacedRepetition, settingsWithEnqueue as any);

  // Should have 5 choices: skip and 4 multiplier choices (no never)
  expect(choices).toHaveLength(5);

  // Check that the NEVER button is not present
  const neverChoice = choices.find(choice => choice.nextRepetition === 'NEVER');
  expect(neverChoice).toBeUndefined();
});
