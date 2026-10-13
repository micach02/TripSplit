import { describe, expect, it } from 'vitest'
import { summarizeMySpending, type ShareRow } from '@/utils/calculations/mySpending'

const ME = 'me'
const row = (overrides: Partial<ShareRow>): ShareRow => ({
  expenseId: Math.random().toString(36),
  tripId: 'home',
  tripName: 'Household',
  tripKind: 'budget',
  tripCurrency: 'PHP',
  categoryName: 'Groceries',
  categoryIcon: '🛒',
  categoryColor: '#22c55e',
  description: 'Market',
  date: '2026-10-05',
  paymentMethod: 'cash',
  paidBy: ME,
  total: 100_000,
  myShare: 100_000,
  ...overrides,
})

// 1 USD = ₱56; JPY has no rate
const convert = (minor: number, from: string) => (from === 'PHP' ? minor : from === 'USD' ? minor * 56 : null)

const rows: ShareRow[] = [
  row({ date: '2026-10-05', myShare: 150_000, total: 300_000, paymentMethod: 'gcash' }),
  row({ date: '2026-10-05', categoryName: 'Dining out', categoryIcon: '🍽️', myShare: 50_000, total: 50_000, paymentMethod: 'card' }),
  // Someone else paid; I owe my share
  row({ date: '2026-10-08', categoryName: 'groceries', tripId: 'trip', tripName: 'Tokyo', tripKind: 'trip', tripCurrency: 'USD', myShare: 1_000, total: 3_000, paidBy: 'friend' }),
  row({ date: '2026-10-09', tripCurrency: 'JPY', myShare: 500, total: 500 }),
  row({ date: '2026-09-20', myShare: 100_000, total: 100_000 }),
  row({ date: '2026-09-21', categoryName: 'Dining out', categoryIcon: '🍽️', myShare: 100_000, total: 100_000 }),
]

const summary = summarizeMySpending({
  rows,
  incomes: [{ id: 'i1', amount: 1_000_000, currency: 'PHP', date: '2026-10-01', source: 'Salary' }],
  month: '2026-10',
  trendMonths: ['2026-08', '2026-09', '2026-10'],
  userId: ME,
  convert,
  today: '2026-10-10',
})

describe('summarizeMySpending', () => {
  it('totals your share this month, in one currency, against last month', () => {
    // ₱1,500 + ₱500 + $10 (= ₱560); the JPY one can't be converted
    expect(summary.total).toBe(256_000)
    expect(summary.previousTotal).toBe(200_000)
    expect(summary.changePercent).toBe(28)
    expect(summary.missingCurrencies).toEqual(['JPY'])
  })

  it('groups categories by name across budgets and trips', () => {
    expect(summary.byCategory.map((c) => [c.name, c.amount, c.percent])).toEqual([
      ['Groceries', 206_000, 80.5],
      ['Dining out', 50_000, 19.5],
    ])
    expect(summary.categoryChanges.map((c) => [c.name, c.delta])).toEqual([
      ['Groceries', 106_000],
      ['Dining out', -50_000],
    ])
  })

  it('splits by budget/trip and day, and shows what you paid by method', () => {
    expect(summary.byTrip.map((t) => [t.tripName, t.amount])).toEqual([
      ['Household', 200_000],
      ['Tokyo', 56_000],
    ])
    expect(summary.byDay).toHaveLength(31)
    expect(summary.byDay[4]).toEqual({ date: '2026-10-05', amount: 200_000 })
    // Only expenses you paid for, at their full amount
    expect(summary.byPaymentMethod).toEqual([
      { method: 'gcash', amount: 300_000 },
      { method: 'card', amount: 50_000 },
    ])
  })

  it('tracks months, income and savings', () => {
    expect(summary.months).toEqual([
      { month: '2026-08', amount: 0 },
      { month: '2026-09', amount: 200_000 },
      { month: '2026-10', amount: 256_000 },
    ])
    expect(summary.income).toBe(1_000_000)
    expect(summary.saved).toBe(744_000)
    expect(summary.savingsRate).toBe(74.4)
    expect(summary.forecast?.projectedMinor).toBe(793_600)
    expect(summary.rows.map((r) => r.date)).toEqual(['2026-10-08', '2026-10-05', '2026-10-05'])
  })

  it('has no savings figure without income', () => {
    const empty = summarizeMySpending({ rows: [], incomes: [], month: '2026-10', trendMonths: ['2026-10'], userId: ME, convert, today: '2026-10-10' })
    expect(empty).toMatchObject({ total: 0, saved: null, savingsRate: null, changePercent: null, byCategory: [] })
  })
})
