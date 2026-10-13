import type { ExpenseTemplate } from '@/components/expenses/ExpenseForm'
import type { ExpenseWithSplits } from '@/services/expenseService'
import type { RecurringExpense, Trip } from '@/types/models'
import type { SplitMethod } from '@/utils/calculations/expenseSplit'
import { toDecimalString, toMinor } from '@/utils/calculations/money'
import { recurringDate } from '@/utils/recurring'
import { todayIso } from '@/utils/tripStatus'

/** A split value as the form shows it ('' for equal splits). */
export function splitValueText(method: SplitMethod, value: number | null, currency: string): string {
  if (value === null || method === 'equal') return ''
  if (method === 'custom') return toDecimalString(toMinor(value, currency), currency)
  return String(value)
}

/** "Add again": the same expense, dated today. */
export function templateFromExpense(expense: ExpenseWithSplits, tripCurrency: string): ExpenseTemplate {
  const method = expense.expense_splits[0]?.split_type ?? 'equal'
  return {
    description: expense.description,
    categoryId: expense.category_id,
    amount: toDecimalString(toMinor(expense.amount, expense.currency), expense.currency),
    currency: expense.currency,
    exchangeRate: expense.currency === tripCurrency ? undefined : String(expense.exchange_rate),
    paymentMethod: expense.payment_method,
    paidBy: expense.paid_by,
    participants: expense.expense_splits.map((split) => split.user_id),
    method,
    values: Object.fromEntries(
      expense.expense_splits.map((split) => [split.user_id, splitValueText(method, split.value, expense.currency)]),
    ),
  }
}

/** A recurring reminder's expense for `month` ('yyyy-MM'), dated on its day (never in the future). */
export function templateFromRecurring(
  recurring: RecurringExpense,
  trip: Pick<Trip, 'currency'>,
  month: string,
): ExpenseTemplate {
  const date = recurringDate(month, recurring.day_of_month)
  const today = todayIso()
  return {
    description: recurring.description,
    categoryId: recurring.category_id,
    amount: toDecimalString(toMinor(recurring.amount, trip.currency), trip.currency),
    currency: trip.currency,
    paymentMethod: recurring.payment_method,
    paidBy: recurring.paid_by,
    participants: recurring.participant_ids,
    method: 'equal',
    expenseDate: date > today ? today : date,
    recurringId: recurring.id,
    recurringMonth: month,
  }
}
