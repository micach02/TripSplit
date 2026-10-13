/**
 * Quick-entry help from your own past expenses in a budget or trip: suggest
 * the description as you type (with its category, amount and payment method),
 * and put your most-used categories first.
 */

export interface PastExpense {
  description: string
  categoryId: string
  /** Decimal string in `currency` */
  amount: string
  currency: string
  paymentMethod: string | null
  /** ISO timestamp, newest first */
  createdAt: string
}

export interface Suggestion {
  description: string
  categoryId: string
  amount: string
  currency: string
  paymentMethod: string | null
  /** How many times it was used */
  uses: number
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()

/** One suggestion per description (latest details win), most used first. */
export function buildSuggestions(past: readonly PastExpense[]): Suggestion[] {
  const byKey = new Map<string, Suggestion & { latest: string }>()
  for (const expense of past) {
    const key = normalize(expense.description)
    if (!key) continue
    const details = {
      description: expense.description.trim(),
      categoryId: expense.categoryId,
      amount: expense.amount,
      currency: expense.currency,
      paymentMethod: expense.paymentMethod,
      latest: expense.createdAt,
    }
    const existing = byKey.get(key)
    if (!existing) byKey.set(key, { ...details, uses: 1 })
    else {
      existing.uses += 1
      if (details.latest > existing.latest) Object.assign(existing, details)
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.uses - a.uses || b.latest.localeCompare(a.latest))
    .map(({ latest: _latest, ...suggestion }) => suggestion)
}

/** Suggestions for what's typed: starts-with first, then word starts, then anywhere. */
export function matchSuggestions(query: string, suggestions: readonly Suggestion[], limit = 4): Suggestion[] {
  const q = normalize(query)
  if (q.length < 1) return suggestions.slice(0, limit)
  const scored = suggestions
    .map((suggestion) => {
      const text = normalize(suggestion.description)
      if (text === q) return null
      const score = text.startsWith(q) ? 0 : text.split(' ').some((word) => word.startsWith(q)) ? 1 : text.includes(q) ? 2 : -1
      return score < 0 ? null : { suggestion, score }
    })
    .filter((item): item is { suggestion: Suggestion; score: number } => item !== null)
  return scored
    .sort((a, b) => a.score - b.score || b.suggestion.uses - a.suggestion.uses)
    .slice(0, limit)
    .map((item) => item.suggestion)
}

/** Your most-used categories lately (up to `limit`), most used first. */
export function frequentCategoryIds(past: readonly PastExpense[], limit = 4, window = 40): string[] {
  const counts = new Map<string, number>()
  for (const expense of past.slice(0, window)) counts.set(expense.categoryId, (counts.get(expense.categoryId) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}
