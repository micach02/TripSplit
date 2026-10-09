/**
 * Budget usage for a trip (or a category), computed on integer minor units.
 * Threshold checks use BigInt so they stay exact for any amount.
 */

/** Budget warning thresholds, in percent of the budget spent. */
export const BUDGET_THRESHOLDS = [50, 75, 90, 100] as const
export type BudgetThreshold = 0 | (typeof BUDGET_THRESHOLDS)[number]

export interface BudgetUsage {
  budget: number
  spent: number
  /** budget − spent; negative when over budget */
  remaining: number
  /** How far over budget (0 when within budget) */
  overBy: number
  /** Percent of the budget spent, to one decimal place (64.9). null when there is no budget. */
  percentUsed: number | null
  /** Highest warning threshold reached: 0, 50, 75, 90 or 100 (100 = at or over budget). */
  threshold: BudgetThreshold
}

function assertMinor(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of minor units, got ${value}`)
  }
}

export function getBudgetUsage(spent: number, budget: number): BudgetUsage {
  assertMinor(spent, 'spent')
  assertMinor(budget, 'budget')

  const remaining = budget - spent
  const overBy = Math.max(0, spent - budget)

  if (budget === 0) {
    return { budget, spent, remaining, overBy, percentUsed: null, threshold: spent > 0 ? 100 : 0 }
  }

  const spentBig = BigInt(spent)
  const budgetBig = BigInt(budget)

  // Tenths of a percent, rounded half up: spent × 1000 / budget
  const tenths = (spentBig * 2000n + budgetBig) / (2n * budgetBig)

  let threshold: BudgetThreshold = 0
  for (const candidate of BUDGET_THRESHOLDS) {
    if (spentBig * 100n >= budgetBig * BigInt(candidate)) threshold = candidate
  }

  return { budget, spent, remaining, overBy, percentUsed: Number(tenths) / 10, threshold }
}

export interface BudgetWarning {
  tone: 'info' | 'warning' | 'danger'
  title: string
  message: string
}

/**
 * The message for the highest threshold reached (50 / 75 / 90 / 100%), or null
 * below 50% or when there's no budget. `formatAmount` formats minor units.
 */
export function getBudgetWarning(usage: BudgetUsage, formatAmount: (minor: number) => string): BudgetWarning | null {
  if (usage.budget === 0) return null
  if (usage.overBy > 0) {
    return {
      tone: 'danger',
      title: 'Over budget',
      message: `You're ${formatAmount(usage.overBy)} over your trip budget.`,
    }
  }
  switch (usage.threshold) {
    case 100:
      return { tone: 'danger', title: 'Budget used up', message: "You've used 100% of your trip budget." }
    case 90:
      return { tone: 'warning', title: 'Almost there', message: "You've used 90% of your trip budget." }
    case 75:
      return { tone: 'warning', title: 'Heads up', message: "You've used 75% of your trip budget." }
    case 50:
      return { tone: 'info', title: 'Halfway', message: "You've used half of your trip budget." }
    default:
      return null
  }
}

export type BudgetTone = 'neutral' | 'warning' | 'danger'

/** Colour semantics for budget indicators: blue under 75%, orange from 75%, red at or over budget. */
export function budgetTone(usage: BudgetUsage): BudgetTone {
  if (usage.threshold >= 100) return 'danger'
  if (usage.threshold >= 75) return 'warning'
  return 'neutral'
}
