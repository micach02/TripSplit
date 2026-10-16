import { Link } from 'react-router'
import { ChartPie, Plus } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { paths } from '@/routes/paths'
import type { DashboardSummary } from '@/services/dashboardService'
import { formatMoney } from '@/utils/calculations/money'

const chip = 'rounded-full px-3 py-1 text-sm font-bold'

/**
 * The top of the dashboard: what's been spent across everything running now,
 * against the budgets, plus what you're owed or owe. Sits on the fixed brand
 * colours, so white text reads the same in light and dark mode.
 */
export function DashboardHero({ summary }: { summary: DashboardSummary }) {
  const { currency, totals, activeTrips, balanceTotals } = summary
  const format = (minor: number) => formatMoney(minor, currency)
  const over = totals.remaining < 0
  const percent = totals.budget > 0 ? Math.min(100, Math.round((totals.spent / totals.budget) * 100)) : 0
  const travelling = activeTrips.some((trip) => trip.kind === 'trip')

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-800 via-brand-700 to-brand-600 p-5 text-white shadow-float sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -top-9 -right-9 size-28 rounded-full bg-sunset-400 sm:-top-10 sm:-right-10 sm:size-32" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-48 rounded-full bg-white/[0.07]" />
      <span aria-hidden className="pointer-events-none absolute top-3 right-4 text-3xl sm:top-4 sm:right-5 sm:text-4xl">
        {travelling ? '✈️' : '🧺'}
      </span>

      <p className="relative pr-20 text-sm font-semibold text-white/90">
        Spent across {activeTrips.length === 1 ? '1 active budget or trip' : `${activeTrips.length} active budgets & trips`}
      </p>
      <p className="relative mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{format(totals.spent)}</p>

      {totals.budget > 0 && (
        <>
          <p className="relative mt-1 text-sm text-white/90">of {format(totals.budget)} budgeted</p>
          <div
            role="progressbar"
            aria-label="Budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/20"
          >
            <div className="h-full rounded-full bg-sunset-400" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}

      {(totals.budget > 0 || balanceTotals.owedToMe > 0 || balanceTotals.iOwe > 0) && (
        <div className="relative mt-4 flex flex-wrap gap-2">
          {totals.budget > 0 && (
            <span className={cn(chip, over ? 'bg-danger-700' : 'bg-brand-800/70')}>
              {over ? `${format(-totals.remaining)} over budget` : `${format(totals.remaining)} left`}
            </span>
          )}
          {balanceTotals.owedToMe > 0 && <span className={cn(chip, 'bg-brand-800/70')}>You’re owed {format(balanceTotals.owedToMe)} 🎉</span>}
          {balanceTotals.iOwe > 0 && <span className={cn(chip, 'bg-brand-800/70')}>You owe {format(balanceTotals.iOwe)}</span>}
        </div>
      )}

      <div className="relative mt-5 flex flex-wrap gap-2">
        <ButtonLink to={paths.addExpense} variant="accent" icon={<Plus className="size-5" aria-hidden />}>
          Add expense
        </ButtonLink>
        <Link
          to={paths.spending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-800/70 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-800"
        >
          <ChartPie className="size-4" aria-hidden />
          My spending
        </Link>
      </div>
    </div>
  )
}
