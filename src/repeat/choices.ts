import { DateTime, Duration } from 'luxon';

import { summarizeDueAt } from './utils';
import { Repetition, RepeatChoice } from './repeatTypes';
import { uniqByField } from '../utils';
import { RepeatPluginSettings } from '../settings';
import { parseTime } from './parsers';

export const DISMISS_BUTTON_TEXT = 'dismiss';

export const SKIP_PERIOD_MINUTES = 5;
export const SKIP_BUTTON_TEXT = `${SKIP_PERIOD_MINUTES} minutes (skip)`;

/**
 * Determines next repetition date.
 * @param repetition A note Repetition object.
 * @param settings Plugin settings.
 * @returns When the note is next due.
 */
export function incrementRepeatDueAt({
  repeatDueAt,
  repeatPeriodUnit,
  repeatPeriod,
  repeatTimeOfDay,
}: Repetition, settings: RepeatPluginSettings): DateTime {
  const now = DateTime.now();
  const dueAt = repeatDueAt ?? now.minus({ second: 1 });
  let repetitions = 1;
  if (dueAt <= now) {
    const overdueBy = now.diff(dueAt);
    const repeatPeriodDuration = Duration.fromObject({
      [repeatPeriodUnit.toLowerCase()]: repeatPeriod,
    });
    repetitions = Math.ceil((overdueBy as any) / (repeatPeriodDuration as any));
  }
  const morningReviewTime = parseTime(settings.morningReviewTime);
  const eveningReviewTime = parseTime(settings.eveningReviewTime);
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
      nextRepetition: null,
    }];
  }
  const nextRepeatDueAt = incrementRepeatDueAt({ ...repetition }, settings);
  return [{
    text: SKIP_BUTTON_TEXT,
    nextRepetition: {
      ...repetition,
      repeatDueAt: getSkipDateTime(now),
    }
  }, {
    text: summarizeDueAt(nextRepeatDueAt, now),
    nextRepetition: {
      ...repetition,
      repeatDueAt: nextRepeatDueAt,
    },
  }];
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
      nextRepetition: null,
    }];
  }
  const morningReviewTime = parseTime(settings.morningReviewTime);
  const eveningReviewTime = parseTime(settings.eveningReviewTime);
  const multiplierChoices = [0.5, 1.0, 1.5, 2.0].map((multiplier) => {
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
  return uniqByField([
    {
      text: SKIP_BUTTON_TEXT,
      nextRepetition: {
        ...repetition,
        repeatDueAt: getSkipDateTime(now),
      },
    },
    ...multiplierChoices,
  ], 'text');
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
  const { repeatStrategy } = repetition;
  const now = DateTime.now();
  if (repeatStrategy === 'PERIODIC') {
    return getPeriodicRepeatChoices(repetition, now, settings);
  }
  if (repeatStrategy === 'SPACED') {
    return getSpacedRepeatChoices(repetition, now, settings);
  }
  return [{
    text: DISMISS_BUTTON_TEXT,
    nextRepetition: null,
  }];
}
