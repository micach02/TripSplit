import { describe, expect, it } from 'vitest'
import { budgetTone, getBudgetUsage, getBudgetWarning } from './budgetCalculator'
import { formatMoney } from './money'

// All amounts are minor units (centavos).
const peso = (value: number) => value * 100

describe('getBudgetUsage', () => {
  it('matches the dashboard example: ₱32,450 of ₱50,000', () => {
    const usage = getBudgetUsage(peso(32450), peso(50000))
    expect(usage.percentUsed).toBe(64.9)
    expect(usage.remaining).toBe(peso(17550))
    expect(usage.overBy).toBe(0)
    expect(usage.threshold).toBe(50)
  })

  it('reports how far over budget a trip is', () => {
    const usage = getBudgetUsage(peso(54250), peso(50000))
    expect(usage.overBy).toBe(peso(4250))
    expect(usage.remaining).toBe(-peso(4250))
    expect(usage.percentUsed).toBe(108.5)
    expect(usage.threshold).toBe(100)
  })

  it('hits each warning threshold exactly', () => {
    expect(getBudgetUsage(peso(24999), peso(50000)).threshold).toBe(0)
    expect(getBudgetUsage(peso(25000), peso(50000)).threshold).toBe(50)
    expect(getBudgetUsage(peso(37500), peso(50000)).threshold).toBe(75)
    expect(getBudgetUsage(peso(45000), peso(50000)).threshold).toBe(90)
    expect(getBudgetUsage(peso(50000), peso(50000)).threshold).toBe(100)
  })

  it('does not round up into a threshold early', () => {
    // 89.999% shows as 90.0 but has not reached the 90% warning
    const usage = getBudgetUsage(8999900, 10000000)
    expect(usage.percentUsed).toBe(90)
    expect(usage.threshold).toBe(75)
  })

  it('rounds the percentage to one decimal', () => {
    expect(getBudgetUsage(1, 3).percentUsed).toBe(33.3)
    expect(getBudgetUsage(2, 3).percentUsed).toBe(66.7)
  })

  it('handles a zero budget', () => {
    expect(getBudgetUsage(0, 0)).toMatchObject({ percentUsed: null, threshold: 0, overBy: 0 })
    expect(getBudgetUsage(peso(100), 0)).toMatchObject({ percentUsed: null, threshold: 100, overBy: peso(100) })
  })

  it('stays exact for very large amounts', () => {
    const budget = 99_999_999_999_999
    expect(getBudgetUsage(budget, budget).threshold).toBe(100)
    expect(getBudgetUsage(budget - 1, budget).threshold).toBe(90)
  })

  it('rejects invalid input', () => {
    expect(() => getBudgetUsage(-1, 100)).toThrow()
    expect(() => getBudgetUsage(1.5, 100)).toThrow()
  })
})

describe('getBudgetWarning', () => {
  const php = (minor: number) => formatMoney(minor, 'PHP')
  const warn = (spent: number, budget = 50000) => getBudgetWarning(getBudgetUsage(peso(spent), peso(budget)), php)

  it('stays quiet below 50%', () => {
    expect(warn(20000)).toBeNull()
  })

  it('escalates through 50, 75, 90 and 100%', () => {
    expect(warn(25000)).toMatchObject({ tone: 'info' })
    expect(warn(37500)).toMatchObject({ tone: 'warning', message: "You've used 75% of your trip budget." })
    expect(warn(45000)).toMatchObject({ tone: 'warning', message: "You've used 90% of your trip budget." })
    expect(warn(50000)).toMatchObject({ tone: 'danger', message: "You've used 100% of your trip budget." })
  })

  it('says how far over budget the trip is', () => {
    expect(warn(54250)).toMatchObject({
      tone: 'danger',
      title: 'Over budget',
      message: "You're ₱4,250 over your trip budget.",
    })
  })

  it('has nothing to say without a budget', () => {
    expect(getBudgetWarning(getBudgetUsage(peso(100), 0), php)).toBeNull()
  })
})

describe('budgetTone', () => {
  it('maps thresholds to colour semantics', () => {
    expect(budgetTone(getBudgetUsage(peso(100), peso(1000)))).toBe('neutral')
    expect(budgetTone(getBudgetUsage(peso(800), peso(1000)))).toBe('warning')
    expect(budgetTone(getBudgetUsage(peso(1000), peso(1000)))).toBe('danger')
  })
})
