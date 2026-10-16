import { Link } from 'react-router'
import { ReceiptText } from 'lucide-react'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'
import { Card, CardHeader } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { tripPath } from '@/routes/paths'
import { listRecentExpenses } from '@/services/expenseService'
import { formatAmount } from '@/utils/calculations/money'
import { firstName, formatDate } from '@/utils/format'

const loadRecent = () => listRecentExpenses(6)

/** The latest expenses across all of the user's trips. */
export function RecentExpenses() {
  const { data, error } = useAsync(loadRecent)

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Recent expenses" />
      <div className="mt-3">
        {error && !data ? (
          <p className="px-5 pb-5 text-sm text-slate-500 sm:px-6">Recent expenses couldn’t be loaded.</p>
        ) : !data ? (
          <div className="flex justify-center py-8 text-primary-600">
            <Spinner />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-4 pb-8 text-center">
            <ReceiptText className="size-8 text-slate-300" aria-hidden />
            <p className="mt-2 text-sm text-slate-500">No expenses yet. They’ll show up here as your group logs them.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((expense) => (
              <li key={expense.id}>
                <Link
                  to={tripPath(expense.tripId, 'expenses')}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6"
                >
                  <CategoryIcon icon={expense.categoryIcon} color={expense.categoryColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{expense.description}</p>
                    <p className="truncate text-xs text-slate-500">
                      {firstName(expense.payerName)} · {expense.tripName} · {formatDate(expense.expenseDate)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatAmount(expense.convertedAmount, expense.currency)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
