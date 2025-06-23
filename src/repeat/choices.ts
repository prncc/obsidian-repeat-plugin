import { DateTime, Duration } from 'luxon';

import { summarizeDueAt } from './utils';
import { Repetition, RepeatChoice } from './repeatTypes';
import { uniqByField } from '../utils';
import { RepeatPluginSettings } from '../settings';
import { parseTime } from './parsers';

export const DISMISS_BUTTON_TEXT = 'Dismiss';
export const NEVER_BUTTON_TEXT = 'Never';

export const SKIP_PERIOD_MINUTES = 5;
export const SKIP_BUTTON_TEXT = `${SKIP_PERIOD_MINUTES} minutes (skip)`;

/**
 * Determines next repetition date.
 * @param repetition A note Repetition object.
 * @param settings Plugin settings.
 * @returns When the note is next due.
 */
function getNextWeekdayOccurrence(
  currentDate: DateTime,
  weekdays: string[],
  timeOfDay: 'AM' | 'PM',
  morningTime: { hour: number; minute: number },
  eveningTime: { hour: number; minute: number }
): DateTime {
  const weekdayNumbers: Record<string, number> = {
    'sunday': 7,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };

  const targetWeekdays = weekdays.map(day => weekdayNumbers[day]).sort();
  const reviewTime = timeOfDay === 'AM' ? morningTime : eveningTime;

  // Find next occurrence
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const candidateDate = currentDate.plus({ days: daysAhead });
    const candidateWeekday = candidateDate.weekday;

    if (targetWeekdays.includes(candidateWeekday)) {
      const candidateDateTime = candidateDate.set({
        hour: reviewTime.hour,
        minute: reviewTime.minute,
        second: 0,
        millisecond: 0,
      });

      return candidateDateTime;
    }
  }

  // Fallback - should never happen but safety net
  return currentDate.plus({ days: 1 }).set({
    hour: reviewTime.hour,
    minute: reviewTime.minute,
    second: 0,
    millisecond: 0,
  });
}

export function incrementRepeatDueAt({
  repeatDueAt,
  repeatPeriodUnit,
  repeatPeriod,
  repeatTimeOfDay,
  repeatWeekdays,
}: Repetition, settings: RepeatPluginSettings): DateTime {
  const now = DateTime.now();
  const dueAt = repeatDueAt ?? now.minus({ second: 1 });
  const morningReviewTime = parseTime(settings.morningReviewTime);
  const eveningReviewTime = parseTime(settings.eveningReviewTime);

  // Handle weekday-based repetitions
  if (repeatPeriodUnit === 'WEEKDAYS' && repeatWeekdays && repeatWeekdays.length > 0) {
    return getNextWeekdayOccurrence(
      now,
      repeatWeekdays,
      repeatTimeOfDay,
      morningReviewTime,
      eveningReviewTime
    );
  }

  // Handle traditional time-based repetitions
  let repetitions = 1;
  if (dueAt <= now) {
    const overdueBy = now.diff(dueAt);
    const repeatPeriodDuration = Duration.fromObject({
      [repeatPeriodUnit.toLowerCase()]: repeatPeriod,
    });
    repetitions = Math.ceil((overdueBy as any) / (repeatPeriodDuration as any));
  }

  const nextRepeatDueAt = dueAt.plus({
    [repeatPeriodUnit.toLowerCase()]: repetitions * repeatPeriod,
  }).set(repeatTimeOfDay === 'AM' ? {
    hour: morningReviewTime.hour,
    minute: morningReviewTime.minute,
    second: 0,
    millisecond: 0,
  } : {
    hour: eveningReviewTime.hour,
    minute: eveningReviewTime.minute,
    second: 0,
    millisecond: 0,
  });
  if (nextRepeatDueAt < now) {
    // Example: now = 8am, due = 7am -> due at is at 6am, in the past.
    return nextRepeatDueAt.plus({
      days: 1,
    });
  }
  return nextRepeatDueAt;
}

function summarizeWeekdayDueAt(dueAt: DateTime, now: DateTime): string {
  const dayName = dueAt.toFormat('cccc'); // Full day name like "Tuesday"

  // Check if it's in the same calendar week and after today
  const currentWeekday = now.weekday; // 1=Monday, 7=Sunday
  const dueWeekday = dueAt.weekday;

  // Get the start of the current week (Monday)
  const startOfCurrentWeek = now.startOf('week');
  const startOfDueWeek = dueAt.startOf('week');

  // If it's the same week and the due day is after today's weekday
  if (startOfCurrentWeek.equals(startOfDueWeek) && dueWeekday > currentWeekday) {
    return dayName;
  }

  // Otherwise, it's next week (or beyond)
  return `next ${dayName}`;
}

const getSkipDateTime = (now: DateTime) => (
  now.plus({
    minutes: SKIP_PERIOD_MINUTES,
  })
);

/**
 * Gets all repeat button choices for a periodic note.
 * @param repetition The note's parsed repetition status.
 * @param now A reference time (for consistent diffs).
 * @param settings Plugin settings.
 * @returns Collection of repeat choices.
 */
function getPeriodicRepeatChoices(
  repetition: Repetition,
  now: DateTime,
  settings: RepeatPluginSettings,
): RepeatChoice[] {
  const { repeatDueAt } = repetition;
  if ((repeatDueAt > now) || !repeatDueAt) {
    return [{
      text: DISMISS_BUTTON_TEXT,
      nextRepetition: 'DISMISS',
    }];
  }
  const nextRepeatDueAt = incrementRepeatDueAt({ ...repetition }, settings);
  const choices: RepeatChoice[] = [{
    text: SKIP_BUTTON_TEXT,
    nextRepetition: {
      ...repetition,
      repeatDueAt: getSkipDateTime(now),
    }
  }, {
    text: repetition.repeatPeriodUnit === 'WEEKDAYS'
      ? summarizeWeekdayDueAt(nextRepeatDueAt, now)
      : summarizeDueAt(nextRepeatDueAt, now),
    nextRepetition: {
      ...repetition,
      repeatDueAt: nextRepeatDueAt,
    },
  }];

  if (settings.enqueueNonRepeatingNotes && repetition.virtual) {
    choices.push({
      text: NEVER_BUTTON_TEXT,
      nextRepetition: 'NEVER',
    });
  }

  return choices;
}

/**
 * Gets all repeat button choices for a spaced note.
 * @param repetition The note's parsed repetition status.
 * @param now A reference time (for consistent diffs).
 * @param settings Plugin settings.
 * @returns Collection of repeat choices.
 */
function getSpacedRepeatChoices(
  repetition: Repetition,
  now: DateTime,
  settings: RepeatPluginSettings,
): RepeatChoice[] {
  const {
    repeatPeriod,
    repeatPeriodUnit,
    repeatTimeOfDay,
  } = repetition;
  const { repeatDueAt } = repetition;
  if ((repeatDueAt > now) || !repeatDueAt) {
    return [{
      text: DISMISS_BUTTON_TEXT,
      nextRepetition: 'DISMISS',
    }];
  }
  const morningReviewTime = parseTime(settings.morningReviewTime);
  const eveningReviewTime = parseTime(settings.eveningReviewTime);
  const multiplierChoices: RepeatChoice[] = [0.5, 1.0, 1.5, 2.0].map((multiplier) => {
    let nextRepeatDueAt = now.plus({
      [repeatPeriodUnit]: multiplier * repeatPeriod,
    });
    // Spaced notes due in at least a week should respect time of day choice.
    if (nextRepeatDueAt.minus({ days: 7 }) >= now) {
      nextRepeatDueAt = nextRepeatDueAt.set(
        repeatTimeOfDay === 'AM' ? {
          hour: morningReviewTime.hour,
          minute: morningReviewTime.minute,
          second: 0,
          millisecond: 0,
        } : {
          hour: eveningReviewTime.hour,
          minute: eveningReviewTime.minute,
          second: 0,
          millisecond: 0,
        });
    }
    // Find the repeat interval summarization.
    // @ts-ignore: .values *does* exist on Duration.
    let { hours } = nextRepeatDueAt.diff(now, 'hours').values || {};
    if (!hours || hours < 1) {
      hours = 1;
    }
    hours = Math.round(hours);
    return {
      text: `${summarizeDueAt(nextRepeatDueAt, now)} (x${multiplier})`,
      nextRepetition: {
        ...repetition,
        repeatDueAt: nextRepeatDueAt,
        repeatPeriod: hours,
        repeatPeriodUnit: 'HOUR',
      }
    };
  });
  const choices: RepeatChoice[] = [
    {
      text: SKIP_BUTTON_TEXT,
      nextRepetition: {
        ...repetition,
        repeatDueAt: getSkipDateTime(now),
      },
    },
    ...multiplierChoices,
  ];
  if (settings.enqueueNonRepeatingNotes && repetition.virtual) {
    choices.push({
      text: NEVER_BUTTON_TEXT,
      nextRepetition: 'NEVER',
    });
  }
  return uniqByField(choices, 'text');
}

/**
 * Get all repetition choices for a note.
 * @param repetition The note's parsed repetition status.
 * @param settings Plugin settings.
 * @returns Collection of repeat choices.
 */
export function getRepeatChoices(
  repetition: Repetition | undefined | null,
  settings: RepeatPluginSettings
): RepeatChoice[] {
  if (!repetition) {
    return [];
  }
  const { repeatStrategy, repeatPeriodUnit } = repetition;
  const now = DateTime.now();
  // Weekday repetitions should always use periodic choices, regardless of strategy
  if (repeatStrategy === 'PERIODIC' || repeatPeriodUnit === 'WEEKDAYS') {
    return getPeriodicRepeatChoices(repetition, now, settings);
  }
  if (repeatStrategy === 'SPACED') {
    return getSpacedRepeatChoices(repetition, now, settings);
  }
  return [{
    text: DISMISS_BUTTON_TEXT,
    nextRepetition: 'DISMISS',
  }];
}
