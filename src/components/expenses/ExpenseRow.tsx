import { Paperclip } from 'lucide-react'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'
import { memberShortName, type TripContextValue } from '@/hooks/useTripContext'
import type { ExpenseWithSplits } from '@/services/expenseService'
import { formatAmount, toMinor } from '@/utils/calculations/money'
import { yourShare } from '@/utils/expenseShare'

export type ExpenseRowContext = Pick<TripContextValue, 'trip' | 'currentUserId' | 'memberById' | 'categoryById' | 'money'>

export function ExpenseRow({
  expense,
  context,
  onSelect,
}: {
  expense: ExpenseWithSplits
  context: ExpenseRowContext
  onSelect: (expense: ExpenseWithSplits) => void
}) {
  const { trip, money } = context
  const category = context.categoryById.get(expense.category_id)
  const share = yourShare(expense, context.currentUserId, trip.currency, (minor) => money.format(minor))
  // Show the original amount when it differs from what's displayed
  const showOriginal = expense.currency !== money.currency
  const people = expense.expense_splits.length

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(expense)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 sm:px-5"
      >
        <CategoryIcon icon={category?.icon ?? '📦'} color={category?.color ?? '#64748b'} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900">
            <span className="truncate">{expense.description}</span>
            {expense.receipt_url && (
              <Paperclip className="size-3.5 shrink-0 text-slate-400" aria-label="Has a receipt" role="img" />
            )}
          </p>
          <p className="truncate text-sm text-slate-500">
            {memberShortName(context, expense.paid_by, { you: true })} paid ·{' '}
            {people === 1 ? '1 person' : `${people} people`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold text-slate-900 tabular-nums">
            {money.format(toMinor(expense.converted_amount, trip.currency))}
          </p>
          {showOriginal && (
            <p className="text-xs text-slate-500 tabular-nums">{formatAmount(expense.amount, expense.currency)}</p>
          )}
          {share && (
            <p
              className={
                share.tone === 'positive'
                  ? 'text-xs font-semibold text-emerald-700 tabular-nums'
                  : 'text-xs font-semibold text-red-600 tabular-nums'
              }
            >
              {share.text}
            </p>
          )}
        </div>
      </button>
    </li>
  )
}
