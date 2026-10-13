import { addDays, format, parseISO } from 'date-fns'
import type { PaymentMethod } from '@/types/models'
import { monthOf, monthPeriod } from '@/utils/budgetPeriod'
import { categoryChanges, forecastMonthEnd, type CategoryChange, type MonthForecast } from '@/utils/calculations/insights'
import type { TripKind } from '@/utils/tripKind'

/**
 * "My spending": your share of every expense you're in, across all budgets
 * and trips, in one currency. Amounts are integer minor units.
 */

export interface ShareRow {
  expenseId: string
  tripId: string
  tripName: string
  tripKind: TripKind
  tripCurrency: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  description: string
  /** 'yyyy-MM-dd' */
  date: string
  paymentMethod: PaymentMethod | null
  paidBy: string
  /** Whole expense, minor units of the trip currency */
  total: number
  /** Your share, minor units of the trip currency */
  myShare: number
}

export interface IncomeRow {
  id: string
  /** Minor units of `currency` */
  amount: number
  currency: string
  date: string
  source: string
}

export interface MySpendingSummary {
  month: string
  total: number
  previousTotal: number
  /** Against last month, one decimal; null when last month was nothing */
  changePercent: number | null
  forecast: MonthForecast | null
  byCategory: Array<{ key: string; name: string; icon: string; color: string; amount: number; percent: number }>
  categoryChanges: CategoryChange[]
  byTrip: Array<{ tripId: string; tripName: string; tripKind: TripKind; amount: number }>
  /** Every day of the month */
  byDay: Array<{ date: string; amount: number }>
  /** What you paid out (expenses you paid for), by how you paid */
  byPaymentMethod: Array<{ method: PaymentMethod | null; amount: number }>
  /** Oldest first, ending with `month` */
  months: Array<{ month: string; amount: number }>
  income: number
  incomes: Array<IncomeRow & { converted: number }>
  /** income − spending; null when no income is recorded */
  saved: number | null
  savingsRate: number | null
  /** This month's expenses, newest first, with your share converted */
  rows: Array<ShareRow & { share: number }>
  /** Currencies that couldn't be converted (left out of the totals) */
  missingCurrencies: string[]
}

interface SummarizeInput {
  rows: readonly ShareRow[]
  incomes: readonly IncomeRow[]
  month: string
  /** Months for the trend, oldest first, ending with `month` */
  trendMonths: readonly string[]
  userId: string
  convert: (minor: number, from: string) => number | null
  today: string
}

const percentOf = (part: number, whole: number) => (whole ? Math.round((part * 1000) / whole) / 10 : 0)

export function summarizeMySpending({ rows, incomes, month, trendMonths, userId, convert, today }: SummarizeInput): MySpendingSummary {
  const missing = new Set<string>()
  const converted = rows.flatMap((row) => {
    const share = convert(row.myShare, row.tripCurrency)
    const total = convert(row.total, row.tripCurrency)
    if (share === null || total === null) {
      missing.add(row.tripCurrency)
      return []
    }
    return [{ ...row, share, paidOut: total }]
  })

  const period = monthPeriod(month)
  const previousMonth = trendMonths.length > 1 ? trendMonths[trendMonths.length - 2] : null
  const thisMonth = converted.filter((row) => monthOf(row.date) === month)
  const lastMonth = previousMonth ? converted.filter((row) => monthOf(row.date) === previousMonth) : []
  const sum = (items: ReadonlyArray<{ share: number }>) => items.reduce((total, item) => total + item.share, 0)
  const total = sum(thisMonth)
  const previousTotal = sum(lastMonth)

  const groupCategories = (items: typeof converted) => {
    const groups = new Map<string, { key: string; name: string; icon: string; color: string; amount: number }>()
    for (const row of items) {
      const key = row.categoryName.trim().toLowerCase()
      const group = groups.get(key) ?? { key, name: row.categoryName, icon: row.categoryIcon, color: row.categoryColor, amount: 0 }
      group.amount += row.share
      groups.set(key, group)
    }
    return [...groups.values()]
  }
  const categoriesNow = groupCategories(thisMonth)
  const byCategory = categoriesNow
    .filter((category) => category.amount > 0)
    .map((category) => ({ ...category, percent: percentOf(category.amount, total) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))

  const tripTotals = new Map<string, { tripId: string; tripName: string; tripKind: TripKind; amount: number }>()
  for (const row of thisMonth) {
    const entry = tripTotals.get(row.tripId) ?? { tripId: row.tripId, tripName: row.tripName, tripKind: row.tripKind, amount: 0 }
    entry.amount += row.share
    tripTotals.set(row.tripId, entry)
  }

  const dayTotals = new Map<string, number>()
  for (const row of thisMonth) dayTotals.set(row.date, (dayTotals.get(row.date) ?? 0) + row.share)
  const byDay: MySpendingSummary['byDay'] = []
  for (let date = period.start; date <= period.end; date = format(addDays(parseISO(date), 1), 'yyyy-MM-dd')) {
    byDay.push({ date, amount: dayTotals.get(date) ?? 0 })
  }

  const methodTotals = new Map<PaymentMethod | null, number>()
  for (const row of thisMonth) {
    if (row.paidBy !== userId) continue
    methodTotals.set(row.paymentMethod, (methodTotals.get(row.paymentMethod) ?? 0) + row.paidOut)
  }

  const monthTotals = new Map<string, number>()
  for (const row of converted) monthTotals.set(monthOf(row.date), (monthTotals.get(monthOf(row.date)) ?? 0) + row.share)

  const incomesConverted = incomes.flatMap((income) => {
    const value = convert(income.amount, income.currency)
    if (value === null) {
      missing.add(income.currency)
      return []
    }
    return [{ ...income, converted: value }]
  })
  const income = incomesConverted.reduce((sumIncome, item) => sumIncome + item.converted, 0)
  const saved = income > 0 ? income - total : null

  return {
    month,
    total,
    previousTotal,
    changePercent: previousTotal > 0 ? Math.round(((total - previousTotal) * 1000) / previousTotal) / 10 : null,
    forecast: forecastMonthEnd(total, period, today),
    byCategory,
    categoryChanges: categoryChanges(categoriesNow, groupCategories(lastMonth)),
    byTrip: [...tripTotals.values()].sort((a, b) => b.amount - a.amount),
    byDay,
    byPaymentMethod: [...methodTotals.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    months: trendMonths.map((m) => ({ month: m, amount: monthTotals.get(m) ?? 0 })),
    income,
    incomes: incomesConverted,
    saved,
    savingsRate: saved !== null ? percentOf(saved, income) : null,
    rows: thisMonth
      .map(({ paidOut: _paidOut, ...row }) => row)
      .sort((a, b) => b.date.localeCompare(a.date) || b.share - a.share),
    missingCurrencies: [...missing].sort(),
  }
}
