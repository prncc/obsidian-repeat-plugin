import { DateTime, Duration } from 'luxon';

import { summarizeDueAt } from './utils';
import { Repetition, RepeatChoice } from './repeatTypes';
import { uniqByField } from '../utils';

export const AM_REVIEW_TIME = 6;
export const PM_REVIEW_TIME = 18;

export const DISMISS_BUTTON_TEXT = 'dismiss';

export const SKIP_PERIOD_MINUTES = 5;
export const SKIP_BUTTON_TEXT = '5 minutes (skip)';

/**
 * Determines when next repeat is due for an already due periodic note.
 * @param repetition A note Repetition object.
 * @returns When the note is next due.
 */
function incrementPeriodicToNextDueAt({
  repeatDueAt,
  repeatPeriodUnit,
  repeatPeriod,
  repeatTimeOfDay,
}: Repetition): DateTime {
  const now = DateTime.now();
  const dueAt = repeatDueAt ?? now;
  if (dueAt > DateTime.now()) {
    return dueAt;
  }
  const overdueBy = now.diff(dueAt);
  const repeatPeriodDuration = Duration.fromObject({
    [repeatPeriodUnit.toLowerCase()]: repeatPeriod,
  });
  const repetitions = Math.ceil((overdueBy as any)/(repeatPeriodDuration as any));
  const nextRepeatDueAt = dueAt.plus({
    [repeatPeriodUnit.toLowerCase()]: repetitions,
  }).set({
    hour: (repeatTimeOfDay === 'AM') ? AM_REVIEW_TIME : PM_REVIEW_TIME,
    minute: 0,
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
};

const getSkipDateTime = (now: DateTime) => (
  now.plus({
    minutes: SKIP_PERIOD_MINUTES,
  })
);

/**
 * Gets all repeat button choices for a periodic note.
 * @param repetition The note's parsed repetition status.
 * @param now A reference time (for consistent diffs).
 * @returns Collection of repeat choices.
 */
function getPeriodicRepeatChoices(repetition: Repetition, now: DateTime): RepeatChoice[] {
  const { repeatDueAt } = repetition;
  if ((repeatDueAt > now) || !repeatDueAt) {
    return [{
      text: DISMISS_BUTTON_TEXT,
      repeatDueAt: null,
      id: 'dismiss',
    }];
  }
  const nextRepeatDueAt = incrementPeriodicToNextDueAt({ ...repetition });
  return [{
    text: SKIP_BUTTON_TEXT,
    repeatDueAt: getSkipDateTime(now),
    id: 'skip',

  }, {
    text: `Repeat in ${summarizeDueAt(nextRepeatDueAt, now)}`,
    repeatDueAt: nextRepeatDueAt,
    id: 'period',
  }];
};

/**
 * Gets all repeat button choices for a spaced note.
 * @param repetition The note's parsed repetition status.
 * @param now A reference time (for consistent diffs).
 * @returns Collection of repeat choices.
 */
function getSpacedRepeatChoices(repetition: Repetition, now: DateTime): RepeatChoice[] {
  let { repeatPeriod } = repetition;
  const { repeatDueAt } = repetition;
  if ((repeatDueAt > now) || !repeatDueAt) {
    return [{
      text: DISMISS_BUTTON_TEXT,
      repeatDueAt: null,
      id: 'dismiss',
    }];
  }
  if (repetition.repeatPeriodUnit !== 'HOUR') {
    repeatPeriod = 1;
  }
  const getNewSpacedPeriod = (multiplier: number) => (
    Math.max(Math.round(multiplier * repeatPeriod), 1)
  );
  const multiplierChoices = [0.5, 1.0, 1.5, 2.0].map((multiplier) => {
    const hours = getNewSpacedPeriod(multiplier);
    const nextRepeatDueAt = now.plus({
      hours,
    });
    return {
      text: `${summarizeDueAt(nextRepeatDueAt, now)} (x${multiplier})`,
      repeatDueAt: nextRepeatDueAt,
      repeatPeriod: hours,
      repeatPeriodUnit: 'HOUR',
      id: multiplier,
    };
  });
  return uniqByField([
    {
      text: SKIP_BUTTON_TEXT,
      repeatDueAt: getSkipDateTime(now),
      repeatPeriod,
      repeatPeriodUnit: 'HOUR',
      id: 'skip',
    },
    ...multiplierChoices,
  ], 'text');
};

/**
 * Get all repetition choices for a note.
 * @param repetition The note's parsed repetition status.
 * @returns Collection of repeat choices.
 */
export function getRepeatChoices(repetition: Repetition): RepeatChoice[] {
  if (!repetition) {
    return [];
  }
  const { repeatStrategy } = repetition;
  const now = DateTime.now();
  if (repeatStrategy === 'PERIODIC') {
    return getPeriodicRepeatChoices(repetition, now);
  }
  if (repeatStrategy === 'SPACED') {
    return getSpacedRepeatChoices(repetition, now);
  }
  return [{
    text: DISMISS_BUTTON_TEXT,
    repeatDueAt: null,
    id: 'dismiss',
  }];
};
