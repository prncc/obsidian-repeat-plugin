jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { parseRepetitionFields } from './parsers';

type RepeatTestInputs = {
  repeat: string,
  overrides?: any,
}

const referenceRepeatDueAt = '2022-03-04T06:00:00.000-05:00';

describe('parseRepetitionFields', () => {
  const expectedRepetition = {
    repeatStrategy: 'PERIODIC',
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
    repeatDueAt: DateTime.fromISO(referenceRepeatDueAt),
    hidden: false,
    virtual: false,
  };
  test.concurrent.each([
    {
      repeat: 'daily',
    },
    {
      repeat: 'weekly',
      overrides: {
        repeatPeriodUnit: 'WEEK',
      },
    },
    {
      repeat: 'monthly',
      overrides: {
        repeatPeriodUnit: 'MONTH',
      },
    },
    {
      repeat: 'yearly',
      overrides: {
        repeatPeriodUnit: 'YEAR',
      },
    },
    {
      repeat: 'annually',
      overrides: {
        repeatPeriodUnit: 'YEAR',
      },
    },
  ])('parses $repeat', ({ repeat, overrides = {} }: RepeatTestInputs) => {
    const repetition = parseRepetitionFields(repeat, referenceRepeatDueAt);
    expect(repetition).toEqual({
      ...expectedRepetition,
      ...overrides
    });
  });

  test.concurrent.each([
    {
      repeat: 'spaced daily',
    },
    {
      repeat: 'spaced weekly',
      overrides: {
        repeatPeriodUnit: 'WEEK',
      },
    },
    {
      repeat: 'spaced monthly',
      overrides: {
        repeatPeriodUnit: 'MONTH',
      },
    },
    {
      repeat: 'spaced yearly',
      overrides: {
        repeatPeriodUnit: 'YEAR',
      },
    },
    {
      repeat: 'spaced annually',
      overrides: {
        repeatPeriodUnit: 'YEAR',
      },
    },
  ])('parses $repeat', ({ repeat, overrides = {} }: RepeatTestInputs) => {
    const repetition = parseRepetitionFields(repeat, referenceRepeatDueAt);
    expect(repetition).toEqual({
      ...expectedRepetition,
      ...overrides,
      repeatStrategy: 'SPACED',
    });
  });
});

describe('parseRepetitionFields', () => {
  const expectedRepetition = {
    repeatStrategy: 'PERIODIC',
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
    repeatDueAt: DateTime.fromISO(referenceRepeatDueAt),
    hidden: false,
    virtual: false,
  };
  const makeUnitCases = (unit: string) => ([{
    repeat: `every ${unit}`,
    overrides: {
      repeatPeriodUnit: unit.toUpperCase(),
    },
  },
  {
    repeat: `every ${unit} in the morning`,
    overrides: {
      repeatPeriodUnit: unit.toUpperCase(),
    },
  },
  {
    repeat: `every ${unit} in the evening`,
    overrides: {
      repeatPeriodUnit: unit.toUpperCase(),
      repeatTimeOfDay: 'PM',
    },
  },
  {
    repeat: `every ${unit} am`,
    overrides: {
      repeatPeriodUnit: unit.toUpperCase(),
    },
  },
  {
    repeat: `every ${unit} pm`,
    overrides: {
      repeatPeriodUnit: unit.toUpperCase(),
      repeatTimeOfDay: 'PM',
    },
  },
  {
    repeat: `every 20 ${unit}s in the morning`,
    overrides: {
      repeatPeriod: 20,
      repeatPeriodUnit: unit.toUpperCase(),
    },
  }]);

  test.concurrent.each([
    ...makeUnitCases('day'),
    ...makeUnitCases('week'),
    ...makeUnitCases('month'),
    ...makeUnitCases('year'),
    ...makeUnitCases('hour').map((testCase) => ({
      repeat: `spaced ${testCase.repeat}`,
      overrides: {
        ...testCase.overrides,
        repeatStrategy: 'SPACED',
      },
    })),
  ])(
    'parses $repeat', ({ repeat, overrides = {} }: RepeatTestInputs) => {
    const repetition = parseRepetitionFields(repeat, referenceRepeatDueAt);
    expect(repetition).toEqual({
      ...expectedRepetition,
      ...overrides
    });
  });
});

test('spaced without period specified', () => {
  const repetition = parseRepetitionFields('spaced', referenceRepeatDueAt) as any;
  delete repetition.repeatDueAt;
  expect(repetition).toEqual({
    repeatStrategy: 'SPACED',
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
    hidden: false,
    virtual: false,
  });
});
