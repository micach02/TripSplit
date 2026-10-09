import { format, isToday, isYesterday } from 'date-fns'
import { ExpenseRow, type ExpenseRowContext } from '@/components/expenses/ExpenseRow'
import type { ExpenseWithSplits } from '@/services/expenseService'
import { sumMinor, toMinor } from '@/utils/calculations/money'
import { toDate } from '@/utils/format'

function dayLabel(isoDate: string): string {
  const date = toDate(isoDate)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, MMM d, yyyy')
}

interface ExpenseListProps {
  expenses: ExpenseWithSplits[]
  context: ExpenseRowContext
  onSelect: (expense: ExpenseWithSplits) => void
  /** Group under date headings (when sorted by date). */
  groupByDate?: boolean
}

export function ExpenseList({ expenses, context, onSelect, groupByDate = true }: ExpenseListProps) {
  if (!groupByDate) {
    return (
      <ul className="divide-y divide-slate-100">
        {expenses.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} context={context} onSelect={onSelect} />
        ))}
      </ul>
    )
  }

  const groups: Array<{ date: string; items: ExpenseWithSplits[] }> = []
  for (const expense of expenses) {
    const last = groups[groups.length - 1]
    if (last && last.date === expense.expense_date) last.items.push(expense)
    else groups.push({ date: expense.expense_date, items: [expense] })
  }

  const currency = context.trip.currency
  return (
    <div>
      {groups.map((group) => {
        const dayTotal = sumMinor(group.items.map((expense) => toMinor(expense.converted_amount, currency)))
        return (
          <section key={group.date} aria-label={dayLabel(group.date)}>
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs font-bold tracking-wide text-slate-500 uppercase sm:px-5">
              <h3>{dayLabel(group.date)}</h3>
              <span className="tabular-nums">{context.money.format(dayTotal)}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.items.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} context={context} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
