import { describe, expect, it } from 'vitest'
import { isBudget, kindCopy, memberCount, timeframe } from '@/utils/tripKind'

describe('trip vs budget wording', () => {
  it('names each kind', () => {
    expect(kindCopy('trip')).toMatchObject({ noun: 'trip', Members: 'Travelers' })
    expect(kindCopy('budget')).toMatchObject({ noun: 'budget', Members: 'People' })
    expect(isBudget({ kind: 'budget' })).toBe(true)
    expect(isBudget({ kind: 'trip' })).toBe(false)
  })

  it('counts members in the right words', () => {
    expect(memberCount('trip', 1)).toBe('1 traveler')
    expect(memberCount('trip', 3)).toBe('3 travelers')
    expect(memberCount('budget', 1)).toBe('1 person')
    expect(memberCount('budget', 2)).toBe('2 people')
  })

  it('describes when it happens', () => {
    expect(timeframe({ kind: 'trip', startDate: '2026-11-03', endDate: '2026-11-08' })).toBe('Nov 3–8, 2026')
    expect(timeframe({ kind: 'budget', startDate: '2026-10-01', endDate: null })).toBe('Monthly budget')
  })
})
