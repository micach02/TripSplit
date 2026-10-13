import { describe, expect, it } from 'vitest'
import { monthPeriod } from '@/utils/budgetPeriod'
import { availableForMonth, budgetAlerts, categoryChanges, forecastMonthEnd, rolloverCarry } from '@/utils/calculations/insights'

const october = monthPeriod('2026-10')
const peso = (minor: number) => `₱${(minor / 100).toLocaleString('en-PH')}`

describe('forecastMonthEnd', () => {
  it('projects the month from the pace so far', () => {
    // ₱6,000 in 10 days → ₱18,600 over 31 days
    expect(forecastMonthEnd(600_000, october, '2026-10-10')).toEqual({
      projectedMinor: 1_860_000,
      daysElapsed: 10,
      daysInMonth: 31,
      early: false,
    })
  })

  it('flags early guesses', () => {
    expect(forecastMonthEnd(50_000, october, '2026-10-03')?.early).toBe(true)
  })

  it('only forecasts the month you’re in', () => {
    expect(forecastMonthEnd(600_000, october, '2026-11-02')).toBeNull()
    expect(forecastMonthEnd(600_000, october, '2026-09-30')).toBeNull()
    expect(forecastMonthEnd(600_000, october, '2026-10-31')).toBeNull()
  })
})

describe('rolloverCarry', () => {
  const spent = new Map([
    ['2026-08', 900_000],
    ['2026-09', 1_300_000],
  ])

  it('adds up what earlier months left over (or overspent)', () => {
    // budget ₱10,000: August +₱1,000, September −₱3,000 → −₱2,000 into October
    expect(rolloverCarry(1_000_000, spent, '2026-08', '2026-10')).toBe(-200_000)
    expect(rolloverCarry(1_000_000, spent, '2026-08', '2026-09')).toBe(100_000)
  })

  it('carries nothing into the first month, and counts empty months as fully unspent', () => {
    expect(rolloverCarry(1_000_000, spent, '2026-08', '2026-08')).toBe(0)
    expect(rolloverCarry(1_000_000, new Map(), '2026-07', '2026-09')).toBe(2_000_000)
  })

  it('gives the amount available this month, never below zero', () => {
    expect(availableForMonth(1_000_000, false, spent, '2026-08', '2026-10')).toEqual({ available: 1_000_000, carry: 0 })
    expect(availableForMonth(1_000_000, true, spent, '2026-08', '2026-09')).toEqual({ available: 1_100_000, carry: 100_000 })
    expect(availableForMonth(1_000_000, true, spent, '2026-08', '2026-10')).toEqual({ available: 800_000, carry: -200_000 })
    const blowout = new Map([['2026-08', 3_500_000]])
    expect(availableForMonth(1_000_000, true, blowout, '2026-08', '2026-09')).toEqual({ available: 0, carry: -2_500_000 })
  })
})

describe('categoryChanges', () => {
  const groceries = { key: 'groceries', name: 'Groceries', icon: '🛒', color: '#22c55e' }
  const dining = { key: 'dining out', name: 'Dining out', icon: '🍽️', color: '#f97316' }
  const rent = { key: 'rent', name: 'Rent', icon: '🏠', color: '#8b5cf6' }

  it('compares each category with last month, biggest moves first', () => {
    const changes = categoryChanges(
      [
        { ...groceries, amount: 800_000 },
        { ...dining, amount: 540_000 },
        { ...rent, amount: 1_500_000 },
      ],
      [
        { ...groceries, amount: 850_000 },
        { ...dining, amount: 400_000 },
        { ...rent, amount: 1_500_000 },
      ],
    )
    expect(changes.map((change) => [change.name, change.delta, change.percent])).toEqual([
      ['Dining out', 140_000, 35],
      ['Groceries', -50_000, -5.9],
    ])
  })

  it('handles categories that are new or gone', () => {
    const changes = categoryChanges([{ ...dining, amount: 100_000 }], [{ ...rent, amount: 300_000 }])
    expect(changes.map((change) => [change.name, change.current, change.previous, change.percent])).toEqual([
      ['Rent', 0, 300_000, -100],
      ['Dining out', 100_000, 0, null],
    ])
  })
})

describe('budgetAlerts', () => {
  const base = { tripId: 't1', tripName: 'Household', currency: 'PHP', month: '2026-10', budgetMinor: 1_000_000 }

  it('warns at 90% and when over, worst first', () => {
    const alerts = budgetAlerts(
      [
        {
          ...base,
          spentMinor: 920_000,
          categories: [
            { id: 'c1', name: 'Dining out', icon: '🍽️', limitMinor: 300_000, spentMinor: 345_000 },
            { id: 'c2', name: 'Groceries', icon: '🛒', limitMinor: 500_000, spentMinor: 200_000 },
          ],
        },
      ],
      peso,
    )
    expect(alerts).toEqual([
      {
        id: 't1:2026-10:c1:over',
        tripId: 't1',
        level: 'over',
        title: '🍽️ Dining out in Household is over budget',
        message: '₱450 over the ₱3,000 limit.',
      },
      {
        id: 't1:2026-10:total:warning',
        tripId: 't1',
        level: 'warning',
        title: 'Household is almost used up',
        message: '92% used — ₱800 left.',
      },
    ])
  })

  it('stays quiet under 90% and without a budget', () => {
    expect(budgetAlerts([{ ...base, spentMinor: 800_000, categories: [] }], peso)).toEqual([])
    expect(budgetAlerts([{ ...base, budgetMinor: 0, spentMinor: 800_000, categories: [] }], peso)).toEqual([])
  })
})
