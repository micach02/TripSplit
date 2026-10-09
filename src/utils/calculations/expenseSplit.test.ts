import { describe, expect, it } from 'vitest'
import { calculateSplits, defaultSplitValues, type SplitParticipantInput } from './expenseSplit'
import { sumMinor } from './money'

const people = (...values: string[]): SplitParticipantInput[] =>
  values.map((value, index) => ({ userId: `u${index + 1}`, value }))

const peso = (major: number) => major * 100

describe('equal split', () => {
  it('splits ₱1,000 three ways as 333.33 / 333.33 / 333.34', () => {
    const result = calculateSplits({
      method: 'equal',
      participants: people('', '', ''),
      totalMinor: peso(1000),
      originalMinor: peso(1000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(true)
    expect(result.splits.map((s) => s.amount)).toEqual([33333, 33333, 33334])
    expect(result.splits.every((s) => s.value === null)).toBe(true)
  })

  it('splits ₱2,000 between 4 people as ₱500 each', () => {
    const result = calculateSplits({
      method: 'equal',
      participants: people('', '', '', ''),
      totalMinor: peso(2000),
      originalMinor: peso(2000),
      expenseCurrency: 'PHP',
    })
    expect(result.splits.map((s) => s.amount)).toEqual([50000, 50000, 50000, 50000])
  })
})

describe('custom amounts', () => {
  it('uses the amounts as given when currencies match', () => {
    const result = calculateSplits({
      method: 'custom',
      participants: people('700', '500', '400', '400'),
      totalMinor: peso(2000),
      originalMinor: peso(2000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(true)
    expect(result.splits.map((s) => s.amount)).toEqual([70000, 50000, 40000, 40000])
    expect(result.splits.map((s) => s.value)).toEqual(['700.00', '500.00', '400.00', '400.00'])
  })

  it('reports what is left to assign', () => {
    const result = calculateSplits({
      method: 'custom',
      participants: people('700', '500', ''),
      totalMinor: peso(2000),
      originalMinor: peso(2000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(false)
    expect(result.assigned).toBe(peso(1200))
    expect(result.remaining).toBe(peso(800))
  })

  it('reports going over the total', () => {
    const result = calculateSplits({
      method: 'custom',
      participants: people('1500', '600'),
      totalMinor: peso(2000),
      originalMinor: peso(2000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(-peso(100))
  })

  it('converts foreign-currency amounts proportionally into the trip currency', () => {
    // S$24.60 → ₱1,045.50; S$10.00 + S$14.60
    const result = calculateSplits({
      method: 'custom',
      participants: people('10', '14.60'),
      totalMinor: 104550,
      originalMinor: 2460,
      expenseCurrency: 'SGD',
    })
    expect(result.ok).toBe(true)
    expect(result.splits.map((s) => s.amount)).toEqual([42500, 62050])
    expect(result.splits.map((s) => s.value)).toEqual(['10.00', '14.60'])
  })

  it('rejects invalid amounts', () => {
    const result = calculateSplits({
      method: 'custom',
      participants: people('abc', '1000'),
      totalMinor: peso(1000),
      originalMinor: peso(1000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(false)
  })
})

describe('percentage split', () => {
  it('splits by 50 / 25 / 15 / 10', () => {
    const result = calculateSplits({
      method: 'percentage',
      participants: people('50', '25', '15', '10'),
      totalMinor: peso(2000),
      originalMinor: peso(2000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(true)
    expect(result.splits.map((s) => s.amount)).toEqual([100000, 50000, 30000, 20000])
    expect(result.splits.map((s) => s.value)).toEqual(['50.00', '25.00', '15.00', '10.00'])
  })

  it('must total exactly 100%', () => {
    const result = calculateSplits({
      method: 'percentage',
      participants: people('50', '25', '15'),
      totalMinor: peso(2000),
      originalMinor: peso(2000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Percentages must add up to 100%.')
    expect(result.remaining).toBe(1000) // 10.00%
  })

  it('handles thirds without losing a centavo', () => {
    const result = calculateSplits({
      method: 'percentage',
      participants: people('33.33', '33.33', '33.34'),
      totalMinor: peso(1000),
      originalMinor: peso(1000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(true)
    expect(sumMinor(result.splits.map((s) => s.amount))).toBe(peso(1000))
  })

  it('rejects malformed or out-of-range percentages', () => {
    const base = { method: 'percentage' as const, totalMinor: 100, originalMinor: 100, expenseCurrency: 'PHP' }
    expect(calculateSplits({ ...base, participants: people('33.333', '66.667') }).ok).toBe(false)
    expect(calculateSplits({ ...base, participants: people('150', '-50') }).ok).toBe(false)
  })
})

describe('shares split', () => {
  it('splits by 2 : 1 : 1', () => {
    const result = calculateSplits({
      method: 'shares',
      participants: people('2', '1', '1'),
      totalMinor: peso(2000),
      originalMinor: peso(2000),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(true)
    expect(result.splits.map((s) => s.amount)).toEqual([100000, 50000, 50000])
    expect(result.splits.map((s) => s.value)).toEqual(['2', '1', '1'])
  })

  it('gives the leftover centavo to the largest remainder', () => {
    const result = calculateSplits({
      method: 'shares',
      participants: people('2', '1', '1'),
      totalMinor: 104550,
      originalMinor: 2460,
      expenseCurrency: 'SGD',
    })
    expect(result.splits.map((s) => s.amount)).toEqual([52275, 26137, 26138])
  })

  it('requires every share to be positive', () => {
    const result = calculateSplits({
      method: 'shares',
      participants: people('2', '0'),
      totalMinor: peso(100),
      originalMinor: peso(100),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(false)
  })
})

describe('general validation', () => {
  it('needs at least one participant', () => {
    const result = calculateSplits({
      method: 'equal',
      participants: [],
      totalMinor: peso(100),
      originalMinor: peso(100),
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(false)
  })

  it('needs an amount', () => {
    const result = calculateSplits({
      method: 'equal',
      participants: people(''),
      totalMinor: 0,
      originalMinor: 0,
      expenseCurrency: 'PHP',
    })
    expect(result.ok).toBe(false)
  })
})

describe('defaultSplitValues', () => {
  it('starts percentages and custom amounts as an even split', () => {
    expect(defaultSplitValues('percentage', 3, 0, 'PHP')).toEqual(['33.33', '33.33', '33.34'])
    expect(defaultSplitValues('custom', 3, peso(1000), 'PHP')).toEqual(['333.33', '333.33', '333.34'])
    expect(defaultSplitValues('shares', 2, 0, 'PHP')).toEqual(['1', '1'])
  })
})
