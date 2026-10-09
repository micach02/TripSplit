import { describe, expect, it } from 'vitest'
import { compareCategoryBudgets, spendingByCategory, spendingByDay } from './analytics'

const categories = [
  { id: 'food', name: 'Food', icon: '🍜', color: '#f97316' },
  { id: 'hotel', name: 'Accommodation', icon: '🏨', color: '#8b5cf6' },
  { id: 'fun', name: 'Activities', icon: '🎢', color: '#ec4899' },
]

const expenses = [
  { categoryId: 'hotel', date: '2026-11-03', total: 2000000 },
  { categoryId: 'food', date: '2026-11-03', total: 250000 },
  { categoryId: 'food', date: '2026-11-05', total: 104550 },
  { categoryId: 'fun', date: '2026-11-04', total: 800000 },
]

describe('spendingByCategory', () => {
  it('totals each category, largest first, with percentages', () => {
    const result = spendingByCategory(expenses, categories)
    expect(result.map((r) => [r.id, r.amount])).toEqual([
      ['hotel', 2000000],
      ['fun', 800000],
      ['food', 354550],
    ])
    expect(result[0].percent).toBe(63.4)
  })

  it('leaves out categories with no spend', () => {
    expect(spendingByCategory([expenses[1]], categories).map((r) => r.id)).toEqual(['food'])
  })
})

describe('spendingByDay', () => {
  it('has a point for every trip day, with running totals', () => {
    const days = spendingByDay(expenses, '2026-11-03', '2026-11-06')
    expect(days.map((d) => d.date)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
    expect(days.map((d) => d.amount)).toEqual([2250000, 800000, 104550, 0])
    expect(days.at(-1)!.cumulative).toBe(3154550)
  })

  it('stretches to include expenses outside the trip dates', () => {
    const days = spendingByDay([{ categoryId: 'food', date: '2026-10-30', total: 100 }], '2026-11-01', '2026-11-02')
    expect(days[0]).toMatchObject({ date: '2026-10-30', amount: 100 })
    expect(days).toHaveLength(4)
  })
})

describe('compareCategoryBudgets', () => {
  it('compares planned with actual spend', () => {
    const rows = compareCategoryBudgets(
      [
        { categoryId: 'hotel', planned: 1500000 },
        { categoryId: 'food', planned: 800000 },
      ],
      expenses,
      categories,
    )
    const hotel = rows.find((r) => r.id === 'hotel')!
    expect(hotel).toMatchObject({ planned: 1500000, actual: 2000000, remaining: -500000, variance: 500000, percentUsed: 133.3 })
    const food = rows.find((r) => r.id === 'food')!
    expect(food).toMatchObject({ actual: 354550, remaining: 445450, variance: -445450, percentUsed: 44.3 })
  })
})
