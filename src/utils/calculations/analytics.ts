import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

/**
 * Aggregations behind the Analytics tab. Inputs and outputs are minor units
 * of the trip currency.
 */

export interface AnalyticsExpense {
  categoryId: string
  /** yyyy-MM-dd */
  date: string
  total: number
}

export interface CategoryInfo {
  id: string
  name: string
  icon: string
  color: string
}

export interface CategorySpend extends CategoryInfo {
  amount: number
  /** Share of total spend, one decimal (37.2) */
  percent: number
}

/** Spend per category, largest first; categories with no spend are left out. */
export function spendingByCategory(expenses: readonly AnalyticsExpense[], categories: readonly CategoryInfo[]): CategorySpend[] {
  const totals = new Map<string, number>()
  for (const expense of expenses) totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.total)
  const grand = [...totals.values()].reduce((sum, value) => sum + value, 0)

  return categories
    .filter((category) => (totals.get(category.id) ?? 0) > 0)
    .map((category) => {
      const amount = totals.get(category.id) ?? 0
      return { ...category, amount, percent: grand ? Math.round((amount * 1000) / grand) / 10 : 0 }
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
}

export interface DailySpend {
  date: string
  amount: number
  cumulative: number
}

/**
 * One point per calendar day across the trip (stretched to include any
 * expenses logged before or after the trip dates); days with no spend are 0.
 */
export function spendingByDay(expenses: readonly AnalyticsExpense[], startDate: string, endDate: string): DailySpend[] {
  const byDate = new Map<string, number>()
  let first = startDate
  let last = endDate
  for (const expense of expenses) {
    byDate.set(expense.date, (byDate.get(expense.date) ?? 0) + expense.total)
    if (expense.date < first) first = expense.date
    if (expense.date > last) last = expense.date
  }

  const days = differenceInCalendarDays(parseISO(last), parseISO(first)) + 1
  const points: DailySpend[] = []
  let cumulative = 0
  for (let i = 0; i < days; i++) {
    const date = format(addDays(parseISO(first), i), 'yyyy-MM-dd')
    const amount = byDate.get(date) ?? 0
    cumulative += amount
    points.push({ date, amount, cumulative })
  }
  return points
}

export interface CategoryBudgetRow extends CategoryInfo {
  planned: number
  actual: number
  /** planned − actual; negative when over */
  remaining: number
  /** actual − planned; positive when over (how far off the plan) */
  variance: number
  /** actual / planned, one decimal; null when planned is 0 */
  percentUsed: number | null
}

/** Planned vs actual for every category that has a budget. */
export function compareCategoryBudgets(
  budgets: ReadonlyArray<{ categoryId: string; planned: number }>,
  expenses: readonly AnalyticsExpense[],
  categories: readonly CategoryInfo[],
): CategoryBudgetRow[] {
  const actual = new Map<string, number>()
  for (const expense of expenses) actual.set(expense.categoryId, (actual.get(expense.categoryId) ?? 0) + expense.total)
  const byId = new Map(categories.map((category) => [category.id, category]))

  return budgets
    .filter((budget) => byId.has(budget.categoryId))
    .map((budget) => {
      const category = byId.get(budget.categoryId)!
      const spent = actual.get(budget.categoryId) ?? 0
      return {
        ...category,
        planned: budget.planned,
        actual: spent,
        remaining: budget.planned - spent,
        variance: spent - budget.planned,
        percentUsed: budget.planned > 0 ? Math.round((spent * 1000) / budget.planned) / 10 : null,
      }
    })
    .sort((a, b) => b.planned - a.planned || a.name.localeCompare(b.name))
}
