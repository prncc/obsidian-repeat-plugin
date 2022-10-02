import { DateTime, DurationUnits } from 'luxon';

function diffSymmetrically(
  now: DateTime,
  then: DateTime,
  resolution: DurationUnits,
): any {
  if (now > then) {
    return now.diff(then, resolution).toObject();
  }
  return then.diff(now, resolution).toObject();
}

/**
 * Makes a succinct, human-readable summary of the diff between dueAt and now.
 * @param dueAt When the note is due.
 * @param now A reference time.
 * @returns A short summary of the time diff between dueAt and now.
 */
export function summarizeDueAt(
  dueAt: DateTime,
  now: DateTime = DateTime.now(),
): string {
  if (!dueAt) {
    return '';
  }
  // First figure out the largest time unit in the diff on a fine scale.
  const resolution = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
  const diff = diffSymmetrically(dueAt, now, resolution as DurationUnits);
  let leadingUnit: DurationUnits | undefined;
  resolution.forEach((unit) => {
    if ((leadingUnit === undefined) && (diff[unit] > 0)) {
      leadingUnit = unit as DurationUnits;
    }
  });
  if ((leadingUnit === undefined) || (leadingUnit === 'seconds')) {
    return 'a moment';
  }
  // Then choose a reporting resolution.
  let reportUnits;
  if (leadingUnit === 'years') {
    reportUnits = ['years', 'months'];
  }
  if (leadingUnit === 'months') {
    reportUnits = ['months', 'days'];
  }
  if (leadingUnit === 'days') {
    if (diff[leadingUnit] < 7) {
      reportUnits = ['days', 'hours'];
    } else {
      reportUnits = ['days'];
    }
  }
  if (leadingUnit === 'hours') {
    if (diff[leadingUnit] < 12) {
      reportUnits = ['hours', 'minutes'];
    } else {
      reportUnits = ['hours'];
    }
  }
  if (leadingUnit === 'minutes') {
    reportUnits = ['minutes'];
  }
  const diffSequence = (reportUnits || []).map((units) => {
    const value = diff[units];
    const summary = `${value} ${value === 1 ? units.slice(0, -1) : units}`;
    return {
      summary,
      units,
      value,
    };
  }).filter(({ value }) => value !== 0);
  if (diffSequence.length > 1) {
    return [diffSequence[0].summary, 'and', diffSequence[1].summary].join(' ');
  }
  if (diffSequence.length === 0) {
    return 'a moment';
  }
  return diffSequence[0].summary;
}

/**
 * Makes a detailed summary of the diff between dueAt and now.
 * @param dueAt When the note is due.
 * @param now A reference time.
 * @returns A detailed summary of the time diff between dueAt and now.
 */
export function fullySummarizeDueAt(
  dueAt: DateTime,
  now: DateTime = DateTime.now(),
): string {
  const diffSummary = summarizeDueAt(dueAt, now);
  if (dueAt > now) {
    return ['Due in', diffSummary].join(' ');
  }
  return ['Overdue by', diffSummary].join(' ');
}
