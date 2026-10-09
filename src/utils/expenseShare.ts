import { formatMoney, toMinor } from '@/utils/calculations/money'

interface ShareInput {
  paid_by: string
  converted_amount: number
  expense_splits: ReadonlyArray<{ user_id: string; amount: number }>
}

export interface YourShare {
  tone: 'positive' | 'negative'
  /** Minor units of the trip currency */
  amount: number
  text: string
}

/**
 * How one expense affects a traveler: the payer "lent" everyone else's shares;
 * a participant "owes" their own share. Null when it doesn't affect them.
 * `format` renders trip-currency minor units (defaults to the trip currency).
 */
export function yourShare(
  expense: ShareInput,
  userId: string,
  tripCurrency: string,
  format: (minor: number) => string = (minor) => formatMoney(minor, tripCurrency),
): YourShare | null {
  const mine = expense.expense_splits.find((split) => split.user_id === userId)
  const myShare = mine ? toMinor(mine.amount, tripCurrency) : 0

  if (expense.paid_by === userId) {
    const lent = toMinor(expense.converted_amount, tripCurrency) - myShare
    return lent > 0 ? { tone: 'positive', amount: lent, text: `You lent ${format(lent)}` } : null
  }
  return myShare > 0 ? { tone: 'negative', amount: myShare, text: `You owe ${format(myShare)}` } : null
}
