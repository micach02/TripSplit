import { getBudgetUsage } from '@/utils/calculations/budgetCalculator'
import { elapsedDays, shiftMonth, type MonthPeriod } from '@/utils/budgetPeriod'

/**
 * Insights for monthly budgets and personal spending. Inputs and outputs are
 * integer minor units of one currency.
 */

export interface MonthForecast {
  /** Spending by the end of the month at the pace so far */
  projectedMinor: number
  daysElapsed: number
  daysInMonth: number
  /** Fewer than 7 days in: a rough guess */
  early: boolean
}

/**
 * Month-end spending at the current daily pace. Only for the month we're in
 * (null before it starts, on its last day, and once it's over).
 */
export function forecastMonthEnd(spentMinor: number, period: MonthPeriod, today: string): MonthForecast | null {
  if (today < period.start || today > period.end) return null
  const daysInMonth = Number(period.end.slice(8, 10))
  const daysElapsed = elapsedDays(period, today)
  if (daysElapsed >= daysInMonth) return null
  return {
    projectedMinor: Math.round((spentMinor * daysInMonth) / daysElapsed),
    daysElapsed,
    daysInMonth,
    early: daysElapsed < 7,
  }
}

/**
 * Money carried into `month` by a rollover budget: every earlier month's budget
 * minus its spending, from the budget's first month. Negative when earlier
 * months overspent. (Uses today's budget amount for past months.)
 */
export function rolloverCarry(
  budgetMinor: number,
  spentByMonth: ReadonlyMap<string, number>,
  firstMonth: string,
  month: string,
): number {
  let carry = 0
  for (let m = firstMonth; m < month; m = shiftMonth(m, 1)) carry += budgetMinor - (spentByMonth.get(m) ?? 0)
  return carry
}

/**
 * What a monthly budget can spend in `month`: its amount, plus (with rollover)
 * whatever earlier months carried over. Never below zero.
 */
export function availableForMonth(
  budgetMinor: number,
  rollover: boolean,
  spentByMonth: ReadonlyMap<string, number>,
  firstMonth: string,
  month: string,
): { available: number; carry: number } {
  if (!rollover) return { available: budgetMinor, carry: 0 }
  const carry = rolloverCarry(budgetMinor, spentByMonth, firstMonth, month)
  return { available: Math.max(0, budgetMinor + carry), carry }
}

export interface CategoryTotal {
  /** What identifies the category across months (an id, or a lower-cased name across budgets) */
  key: string
  name: string
  icon: string
  color: string
  amount: number
}

export interface CategoryChange extends Omit<CategoryTotal, 'amount'> {
  current: number
  previous: number
  /** current − previous */
  delta: number
  /** Change in percent, one decimal; null when there was nothing before */
  percent: number | null
}

/** How each category moved against the previous month, biggest moves first. Unchanged ones are left out. */
export function categoryChanges(current: readonly CategoryTotal[], previous: readonly CategoryTotal[]): CategoryChange[] {
  const byKey = new Map<string, CategoryChange>()
  for (const item of previous) {
    byKey.set(item.key, { ...item, current: 0, previous: item.amount, delta: -item.amount, percent: null })
  }
  for (const item of current) {
    const before = byKey.get(item.key)?.previous ?? 0
    byKey.set(item.key, { ...item, current: item.amount, previous: before, delta: item.amount - before, percent: null })
  }
  return [...byKey.values()]
    .filter((change) => change.delta !== 0)
    .map(({ amount: _amount, ...change }: CategoryChange & { amount?: number }) => ({
      ...change,
      percent: change.previous > 0 ? Math.round((change.delta * 1000) / change.previous) / 10 : null,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name))
}

export interface AlertInput {
  tripId: string
  tripName: string
  currency: string
  /** The month the alert is about ('yyyy-MM'); trips use their own id space */
  month: string
  /** What's available to spend (budgets: this month, with any rollover) */
  budgetMinor: number
  spentMinor: number
  categories: ReadonlyArray<{ id: string; name: string; icon: string; limitMinor: number; spentMinor: number }>
}

export interface BudgetAlert {
  /** Stable per budget, month, category and level: dismissing hides it until it gets worse */
  id: string
  tripId: string
  level: 'warning' | 'over'
  title: string
  message: string
}

/**
 * Budget warnings worth a notification: a budget (or a category limit) at
 * 90% or more, or over. Worst first.
 */
export function budgetAlerts(inputs: readonly AlertInput[], format: (minor: number, currency: string) => string): BudgetAlert[] {
  const alerts: Array<BudgetAlert & { rank: number }> = []

  const consider = (
    input: AlertInput,
    scope: string,
    label: string,
    spent: number,
    limit: number,
  ) => {
    if (limit <= 0) return
    const usage = getBudgetUsage(spent, limit)
    if (usage.threshold < 90) return
    const over = usage.overBy > 0
    const level = over ? 'over' : 'warning'
    alerts.push({
      id: `${input.tripId}:${input.month}:${scope}:${level}`,
      tripId: input.tripId,
      level,
      rank: over ? 0 : 1,
      title: over ? `${label} is over budget` : `${label} is almost used up`,
      message: over
        ? `${format(usage.overBy, input.currency)} over the ${format(limit, input.currency)} limit.`
        : `${usage.percentUsed}% used — ${format(usage.remaining, input.currency)} left.`,
    })
  }

  for (const input of inputs) {
    consider(input, 'total', input.tripName, input.spentMinor, input.budgetMinor)
    for (const category of input.categories) {
      consider(input, category.id, `${category.icon} ${category.name} in ${input.tripName}`, category.spentMinor, category.limitMinor)
    }
  }

  return alerts.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...alert }) => alert)
}
