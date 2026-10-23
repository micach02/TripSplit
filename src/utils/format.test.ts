import { describe, expect, it } from 'vitest'
import { firstName, formatDate, formatDateRange, formatShortDate, initials } from './format'

describe('formatDateRange', () => {
  it('collapses ranges within one month', () => {
    expect(formatDateRange('2026-11-03', '2026-11-08')).toBe('Nov 3–8, 2026')
  })

  it('spans months', () => {
    expect(formatDateRange('2026-10-30', '2026-11-04')).toBe('Oct 30 – Nov 4, 2026')
  })

  it('spans years', () => {
    expect(formatDateRange('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027')
  })

  it('shows a single day once', () => {
    expect(formatDateRange('2026-11-03', '2026-11-03')).toBe('Nov 3, 2026')
  })
})

describe('formatDate', () => {
  it('does not shift calendar dates across time zones', () => {
    expect(formatDate('2026-11-03')).toBe('Nov 3, 2026')
  })
})

describe('formatShortDate', () => {
  it('drops the year for dates this year and keeps it otherwise', () => {
    const now = new Date(2026, 9, 23)
    expect(formatShortDate('2026-11-03', now)).toBe('Nov 3')
    expect(formatShortDate('2025-12-30', now)).toBe('Dec 30, 2025')
  })
})

describe('names', () => {
  it('extracts a first name', () => {
    expect(firstName('Michael Reyes')).toBe('Michael')
    expect(firstName('  Anna  ')).toBe('Anna')
    expect(firstName(null)).toBe('')
  })

  it('builds initials', () => {
    expect(initials('Michael Reyes')).toBe('MR')
    expect(initials('Anna')).toBe('A')
    expect(initials('Maria de la Cruz')).toBe('MC')
    expect(initials('')).toBe('?')
  })
})
