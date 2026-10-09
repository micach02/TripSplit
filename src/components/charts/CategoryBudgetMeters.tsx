import { CircleCheck, TriangleAlert } from 'lucide-react'
import { TableView } from '@/components/charts/TableView'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { TripMoney } from '@/hooks/useDisplayCurrency'
import type { CategoryBudgetRow } from '@/utils/calculations/analytics'
import { budgetTone, getBudgetUsage } from '@/utils/calculations/budgetCalculator'

/** Planned vs actual per category. State is carried by colour AND an icon + words. */
export function CategoryBudgetMeters({ rows, money }: { rows: CategoryBudgetRow[]; money: TripMoney }) {
  return (
    <div>
      <ul className="space-y-4">
        {rows.map((row) => {
          const usage = getBudgetUsage(row.actual, row.planned)
          const tone = budgetTone(usage)
          const over = row.remaining < 0
          return (
            <li key={row.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
                  <span aria-hidden>{row.icon}</span>
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="shrink-0 text-slate-600">
                  <span className="font-bold text-slate-900">{money.format(row.actual)}</span> of {money.format(row.planned)}
                </span>
              </div>
              <ProgressBar
                value={usage.percentUsed ?? 0}
                tone={tone}
                label={`${row.name}: ${usage.percentUsed ?? 0}% of the planned budget used`}
              />
              <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${over ? 'text-red-600' : 'text-slate-500'}`}>
                {over ? (
                  <TriangleAlert className="size-3.5" aria-hidden />
                ) : (
                  <CircleCheck className="size-3.5 text-emerald-600" aria-hidden />
                )}
                {over ? `${money.format(-row.remaining)} over plan` : `${money.format(row.remaining)} left`}
              </p>
            </li>
          )
        })}
      </ul>
      <TableView
        caption="Category budgets: planned, actual, remaining and variance"
        columns={['Category', 'Planned', 'Actual', 'Remaining', 'Variance']}
        rows={rows.map((row) => ({
          key: row.id,
          cells: [
            `${row.icon} ${row.name}`,
            money.format(row.planned),
            money.format(row.actual),
            money.format(row.remaining),
            money.format(row.variance, { signDisplay: 'always' }),
          ],
        }))}
      />
    </div>
  )
}
