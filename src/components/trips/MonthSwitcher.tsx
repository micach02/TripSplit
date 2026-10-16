import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { shiftMonth, type MonthPeriod } from '@/utils/budgetPeriod'

interface MonthSwitcherProps {
  period: MonthPeriod
  range: { earliest: string; latest: string }
  onChange: (month: string) => void
  className?: string
}

const arrow =
  'flex size-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-35 sm:size-9'

/** ‹ October 2026 › for monthly budgets; "This month" jumps back to now. */
export function MonthSwitcher({ period, range, onChange, className }: MonthSwitcherProps) {
  const isCurrent = period.month === range.latest
  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label="Month">
      <button
        type="button"
        className={arrow}
        onClick={() => onChange(shiftMonth(period.month, -1))}
        disabled={period.month <= range.earliest}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <p className="min-w-32 text-center text-sm font-bold text-slate-900" aria-live="polite">
        {period.label}
      </p>
      <button
        type="button"
        className={arrow}
        onClick={() => onChange(shiftMonth(period.month, 1))}
        disabled={isCurrent}
        aria-label="Next month"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(range.latest)}
          className="tap-target ml-1 rounded-md text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          This month
        </button>
      )}
    </div>
  )
}
