import { describe, expect, it } from 'vitest'
import { duePeriods, nextOccurrence, ordinalDay, recurringDate } from '@/utils/recurring'

describe('recurringDate', () => {
  it('uses the day, or the month’s last day when it’s shorter', () => {
    expect(recurringDate('2026-10', 15)).toBe('2026-10-15')
    expect(recurringDate('2026-02', 31)).toBe('2026-02-28')
    expect(recurringDate('2028-02', 30)).toBe('2028-02-29')
    expect(recurringDate('2026-04', 31)).toBe('2026-04-30')
  })
})

describe('duePeriods', () => {
  it('lists months that have come due and aren’t handled', () => {
    const schedule = { dayOfMonth: 5, startsOn: '2026-08-01', lastPeriod: null }
    expect(duePeriods(schedule, '2026-10-04')).toEqual(['2026-08', '2026-09'])
    expect(duePeriods(schedule, '2026-10-05')).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('skips an occurrence before the start date', () => {
    // Created on the 20th for the 15th: the first one is next month.
    expect(duePeriods({ dayOfMonth: 15, startsOn: '2026-10-20', lastPeriod: null }, '2026-11-14')).toEqual([])
    expect(duePeriods({ dayOfMonth: 15, startsOn: '2026-10-20', lastPeriod: null }, '2026-11-15')).toEqual(['2026-11'])
  })

  it('continues after the last handled month', () => {
    expect(duePeriods({ dayOfMonth: 1, startsOn: '2026-01-01', lastPeriod: '2026-09-01' }, '2026-10-12')).toEqual(['2026-10'])
    expect(duePeriods({ dayOfMonth: 1, startsOn: '2026-01-01', lastPeriod: '2026-10-01' }, '2026-10-12')).toEqual([])
  })
})

describe('nextOccurrence', () => {
  it('finds the next date after today', () => {
    expect(nextOccurrence({ dayOfMonth: 15, startsOn: '2026-10-01', lastPeriod: null }, '2026-10-12')).toBe('2026-10-15')
    expect(nextOccurrence({ dayOfMonth: 15, startsOn: '2026-10-01', lastPeriod: '2026-10-01' }, '2026-10-12')).toBe('2026-11-15')
    expect(nextOccurrence({ dayOfMonth: 31, startsOn: '2026-10-01', lastPeriod: '2026-10-01' }, '2026-10-31')).toBe('2026-11-30')
  })

  it('names days', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinalDay)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ])
  })
})
