import { Alert } from '@/components/ui/Alert'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/cn'
import { budgetTone, getBudgetUsage, getBudgetWarning } from '@/utils/calculations/budgetCalculator'

interface BudgetSummaryProps {
  /** Trip-currency minor units */
  budgetMinor: number
  spentMinor: number
  /** Formats trip-currency minor units (possibly converted for display) */
  format: (minor: number) => string
  /** Show the 75/90/100% warning under the bar. */
  showWarning?: boolean
  /** "Budget" (trips) or "Monthly budget" */
  budgetLabel?: string
  className?: string
}

/** Budget · Spent · Remaining with a progress bar — the heart of every trip page. */
export function BudgetSummary({
  budgetMinor,
  spentMinor,
  format,
  showWarning = true,
  budgetLabel = 'Budget',
  className,
}: BudgetSummaryProps) {
  const usage = getBudgetUsage(spentMinor, budgetMinor)
  const tone = budgetTone(usage)
  const over = usage.overBy > 0
  const warning = showWarning ? getBudgetWarning(usage, format, budgetLabel.toLowerCase().replace(/^budget$/, 'trip budget')) : null
  const noBudget = budgetMinor === 0

  return (
    <div className={className}>
      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-slate-500 sm:text-sm">{budgetLabel}</dt>
          <dd className="mt-0.5 truncate text-base font-extrabold tabular-nums sm:text-xl">
            {noBudget ? '—' : format(budgetMinor)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-slate-500 sm:text-sm">Spent</dt>
          <dd className="mt-0.5 truncate text-base font-extrabold tabular-nums sm:text-xl">{format(spentMinor)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-slate-500 sm:text-sm">{over ? 'Over budget' : 'Remaining'}</dt>
          <dd
            className={cn(
              'mt-0.5 truncate text-base font-extrabold tabular-nums sm:text-xl',
              noBudget ? 'text-slate-500' : over ? 'text-red-600' : 'text-emerald-700',
            )}
          >
            {noBudget ? '—' : format(over ? usage.overBy : usage.remaining)}
          </dd>
        </div>
      </dl>

      {usage.percentUsed !== null && (
        <div className="mt-4">
          <ProgressBar value={usage.percentUsed} tone={tone} label={`${usage.percentUsed}% of the ${budgetLabel.toLowerCase()} spent`} />
          <p
            className={cn(
              'mt-1.5 text-xs font-semibold tabular-nums',
              tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-orange-700' : 'text-slate-500',
            )}
          >
            {usage.percentUsed}% spent
          </p>
        </div>
      )}

      {warning && warning.tone !== 'info' && (
        <Alert tone={warning.tone === 'danger' ? 'error' : 'warning'} title={warning.title} className="mt-4">
          {warning.message}
        </Alert>
      )}
    </div>
  )
}
