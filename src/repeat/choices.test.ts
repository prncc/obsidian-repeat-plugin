jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { RepeatChoice, Repetition } from './repeatTypes';
import {
  getRepeatChoices,
  incrementRepeatDueAt,
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

describe('weekday repetition choices', () => {
  test('weekday repetitions use periodic choices even when marked as spaced', () => {
    const spacedWeekdayRepetition = {
      repeatStrategy: 'SPACED',
      repeatPeriod: 1,
      repeatPeriodUnit: 'WEEKDAYS',
      repeatTimeOfDay: 'AM',
      repeatWeekdays: ['tuesday'],
      repeatDueAt: DateTime.fromObject({ year: 2024, month: 1, day: 1, hour: 6 }), // Monday 6 AM (past)
      hidden: false,
      virtual: false,
    } as Repetition;

    // Mock current time to be Monday 10 AM (so the note is due)
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 1, hour: 10 });
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;

    try {
      const choices = getRepeatChoices(spacedWeekdayRepetition, mockPluginSettings as any);
      
      // Should have 2 choices: skip and next occurrence (periodic-style, not spaced multipliers)
      expect(choices).toHaveLength(2);
      expect(choices[0].text).toBe(SKIP_BUTTON_TEXT);
      expect(choices[1].text).toBe('Tuesday'); // Should show "Tuesday" since it's the next occurrence in the same week
    } finally {
      DateTime.now = originalNow;
    }
  });

  test('weekday choice text shows day name instead of duration', () => {
    const weekdayRepetition = {
      repeatStrategy: 'PERIODIC',
      repeatPeriod: 1,
      repeatPeriodUnit: 'WEEKDAYS',
      repeatTimeOfDay: 'AM',
      repeatWeekdays: ['thursday'],
      repeatDueAt: DateTime.fromObject({ year: 2024, month: 1, day: 1, hour: 6 }), // Monday 6 AM (past)
      hidden: false,
      virtual: false,
    } as Repetition;

    // Mock current time to be Monday 10 AM (so the note is due)
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 1, hour: 10 });
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;

    try {
      const choices = getRepeatChoices(weekdayRepetition, mockPluginSettings as any);
      
      expect(choices).toHaveLength(2);
      expect(choices[1].text).toBe('Thursday'); // Should show "Thursday" since Thursday is later this week from Monday
    } finally {
      DateTime.now = originalNow;
    }
  });

  test('weekday choice text shows "next" for following week', () => {
    const weekdayRepetition = {
      repeatStrategy: 'PERIODIC',
      repeatPeriod: 1,
      repeatPeriodUnit: 'WEEKDAYS',
      repeatTimeOfDay: 'AM',
      repeatWeekdays: ['tuesday'],
      repeatDueAt: DateTime.fromObject({ year: 2024, month: 1, day: 3, hour: 6 }), // Wednesday 6 AM (past)
      hidden: false,
      virtual: false,
    } as Repetition;

    // Mock current time to be Wednesday 10 AM (so the note is due, next Tuesday is next week)
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 3, hour: 10 }); // Wednesday
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;

    try {
      const choices = getRepeatChoices(weekdayRepetition, mockPluginSettings as any);
      
      expect(choices).toHaveLength(2);
      expect(choices[1].text).toBe('next Tuesday'); // Should show "next Tuesday" since Tuesday is the following week from Wednesday
    } finally {
      DateTime.now = originalNow;
    }
  });
});

describe('weekday repetition date calculation', () => {
  const weekdayRepetition = {
    repeatStrategy: 'PERIODIC',
    repeatPeriod: 1,
    repeatPeriodUnit: 'WEEKDAYS',
    repeatTimeOfDay: 'AM',
    repeatWeekdays: ['tuesday', 'thursday'],
    repeatDueAt: DateTime.fromObject({ year: 2024, month: 1, day: 1 }), // Monday
    hidden: false,
    virtual: false,
  } as Repetition;

  test('calculates next Tuesday from Monday', () => {
    // Current time is Monday 10 AM
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 1, hour: 10 });
    
    // Mock DateTime.now() to return our test date
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;
    
    try {
      const nextDueAt = incrementRepeatDueAt(weekdayRepetition, mockPluginSettings as any);
      
      // Should be Tuesday at 6 AM
      expect(nextDueAt.weekday).toBe(2); // Tuesday
      expect(nextDueAt.hour).toBe(6);
      expect(nextDueAt.minute).toBe(0);
      expect(nextDueAt.day).toBe(2);
    } finally {
      DateTime.now = originalNow;
    }
  });

  test('calculates next Thursday from Tuesday', () => {
    // Current time is Tuesday 10 AM
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 2, hour: 10 });
    
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;
    
    try {
      const nextDueAt = incrementRepeatDueAt(weekdayRepetition, mockPluginSettings as any);
      
      // Should be Thursday at 6 AM
      expect(nextDueAt.weekday).toBe(4); // Thursday
      expect(nextDueAt.hour).toBe(6);
      expect(nextDueAt.minute).toBe(0);
      expect(nextDueAt.day).toBe(4);
    } finally {
      DateTime.now = originalNow;
    }
  });

  test('wraps to next week when past last weekday', () => {
    // Current time is Friday 10 AM
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 5, hour: 10 });
    
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;
    
    try {
      const nextDueAt = incrementRepeatDueAt(weekdayRepetition, mockPluginSettings as any);
      
      // Should be next Tuesday at 6 AM
      expect(nextDueAt.weekday).toBe(2); // Tuesday
      expect(nextDueAt.hour).toBe(6);
      expect(nextDueAt.minute).toBe(0);
      expect(nextDueAt.day).toBe(9); // Next Tuesday
    } finally {
      DateTime.now = originalNow;
    }
  });

  test('respects evening time preference', () => {
    const eveningWeekdayRepetition = {
      ...weekdayRepetition,
      repeatTimeOfDay: 'PM',
    } as Repetition;
    
    // Current time is Monday 10 AM
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 1, hour: 10 });
    
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;
    
    try {
      const nextDueAt = incrementRepeatDueAt(eveningWeekdayRepetition, mockPluginSettings as any);
      
      // Should be Tuesday at 6 PM
      expect(nextDueAt.weekday).toBe(2); // Tuesday
      expect(nextDueAt.hour).toBe(18); // 6 PM
      expect(nextDueAt.minute).toBe(0);
    } finally {
      DateTime.now = originalNow;
    }
  });

  test('handles single weekday', () => {
    const singleWeekdayRepetition = {
      ...weekdayRepetition,
      repeatWeekdays: ['friday'],
    } as Repetition;
    
    // Current time is Monday 10 AM
    const mockNow = DateTime.fromObject({ year: 2024, month: 1, day: 1, hour: 10 });
    
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;
    
    try {
      const nextDueAt = incrementRepeatDueAt(singleWeekdayRepetition, mockPluginSettings as any);
      
      // Should be Friday at 6 AM
      expect(nextDueAt.weekday).toBe(5); // Friday
      expect(nextDueAt.hour).toBe(6);
      expect(nextDueAt.minute).toBe(0);
      expect(nextDueAt.day).toBe(5);
    } finally {
      DateTime.now = originalNow;
    }
  });
});
