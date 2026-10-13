import { describe, expect, it } from 'vitest'
import {
  clampMonth,
  currentMonth,
  daysLeft,
  elapsedDays,
  monthOf,
  monthPeriod,
  parseMonth,
  recentMonths,
  shiftMonth,
} from '@/utils/budgetPeriod'

describe('months', () => {
  it('reads the month of a date and of today', () => {
    expect(monthOf('2026-10-14')).toBe('2026-10')
    expect(currentMonth('2026-02-28')).toBe('2026-02')
  })

  it('accepts only real yyyy-MM months', () => {
    expect(parseMonth('2026-10')).toBe('2026-10')
    expect(parseMonth('2026-13')).toBeNull()
    expect(parseMonth('2026-1')).toBeNull()
    expect(parseMonth('october')).toBeNull()
    expect(parseMonth(null)).toBeNull()
  })

  it('describes a month, including short months and leap years', () => {
    expect(monthPeriod('2026-10')).toEqual({
      month: '2026-10',
      start: '2026-10-01',
      end: '2026-10-31',
      label: 'October 2026',
      shortLabel: 'Oct 2026',
      name: 'October',
      shortName: 'Oct',
    })
    expect(monthPeriod('2028-02').end).toBe('2028-02-29')
    expect(monthPeriod('2026-02').end).toBe('2026-02-28')
  })

  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-10', -12)).toBe('2025-10')
  })

  it('keeps a month inside the budget’s life', () => {
    expect(clampMonth('2026-05', '2026-09', '2026-10')).toBe('2026-09')
    expect(clampMonth('2027-01', '2026-09', '2026-10')).toBe('2026-10')
    expect(clampMonth('2026-10', '2026-09', '2026-10')).toBe('2026-10')
  })

  it('lists recent months oldest first, stopping at the first month', () => {
    expect(recentMonths('2026-10', 3, '2026-01')).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(recentMonths('2026-10', 6, '2026-09')).toEqual(['2026-09', '2026-10'])
    expect(recentMonths('2026-01', 2, '2025-01')).toEqual(['2025-12', '2026-01'])
  })
})

describe('days in a month', () => {
  const october = monthPeriod('2026-10')

  it('averages over the days so far, or the whole month once it’s over', () => {
    expect(elapsedDays(october, '2026-10-14')).toBe(14)
    expect(elapsedDays(october, '2026-11-02')).toBe(31)
    expect(elapsedDays(october, '2026-09-30')).toBe(1)
  })

  it('counts the days left, including today', () => {
    expect(daysLeft(october, '2026-10-14')).toBe(18)
    expect(daysLeft(october, '2026-10-31')).toBe(1)
    expect(daysLeft(october, '2026-11-01')).toBe(0)
    expect(daysLeft(october, '2026-09-15')).toBe(31)
  })
})
