import { Minus, Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { getCurrency } from '@/lib/currencies'
import type { TripMemberWithProfile } from '@/services/tripService'
import type { SplitCalculation, SplitMethod } from '@/utils/calculations/expenseSplit'
import { formatMoney } from '@/utils/calculations/money'

interface SplitEditorProps {
  method: SplitMethod
  participants: TripMemberWithProfile[]
  currentUserId: string
  values: Record<string, string>
  onValueChange: (userId: string, value: string) => void
  calculation: SplitCalculation
  expenseCurrency: string
  tripCurrency: string
}

// No width here: each method sets its own (w-full inside a sized label, or a fixed w-14).
const inputClasses =
  'h-11 rounded-lg border border-slate-300 bg-surface px-3 text-right text-base font-semibold tabular-nums ' +
  'focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 focus:outline-none sm:text-sm'

function stepShares(value: string, delta: number): string {
  const current = Number.parseFloat(value)
  const next = Math.max(1, Math.round((Number.isFinite(current) ? current : 1) + delta))
  return String(next)
}

/** Per-person inputs for the chosen split method, with each person's resulting share. */
export function SplitEditor({
  method,
  participants,
  currentUserId,
  values,
  onValueChange,
  calculation,
  expenseCurrency,
  tripCurrency,
}: SplitEditorProps) {
  const shareByUser = new Map(calculation.splits.map((split) => [split.userId, split.amount]))
  const symbol = getCurrency(expenseCurrency).symbol.trim()

  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-2xl bg-surface ring-1 ring-slate-200">
        {participants.map((member) => {
          const name = member.userId === currentUserId ? 'You' : member.profile.full_name
          const share = shareByUser.get(member.userId)
          const value = values[member.userId] ?? ''
          return (
            <li key={member.userId} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={member.profile.full_name} src={member.profile.avatar_url} size="sm" decorative />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                {method !== 'equal' && (
                  <p className="text-xs text-slate-500 tabular-nums">
                    {share !== undefined ? formatMoney(share, tripCurrency) : '—'}
                  </p>
                )}
              </div>

              {method === 'equal' && (
                <p className="text-sm font-bold text-slate-900 tabular-nums">
                  {share !== undefined ? formatMoney(share, tripCurrency) : '—'}
                </p>
              )}

              {method === 'custom' && (
                <label className="relative w-32">
                  <span className="sr-only">{`Amount for ${name}`}</span>
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">
                    {symbol}
                  </span>
                  <input
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => onValueChange(member.userId, event.target.value)}
                    className={cn(inputClasses, 'w-full pl-9')}
                    placeholder="0"
                  />
                </label>
              )}

              {method === 'percentage' && (
                <label className="relative w-28">
                  <span className="sr-only">{`Percentage for ${name}`}</span>
                  <input
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => onValueChange(member.userId, event.target.value)}
                    className={cn(inputClasses, 'w-full pr-8')}
                    placeholder="0"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">
                    %
                  </span>
                </label>
              )}

              {method === 'shares' && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onValueChange(member.userId, stepShares(value, -1))}
                    className="flex size-11 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                    aria-label={`Fewer shares for ${name}`}
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <label>
                    <span className="sr-only">{`Shares for ${name}`}</span>
                    <input
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => onValueChange(member.userId, event.target.value)}
                      className={cn(inputClasses, 'w-14 px-2 text-center')}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onValueChange(member.userId, stepShares(value, 1))}
                    className="flex size-11 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                    aria-label={`More shares for ${name}`}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <SplitStatus method={method} calculation={calculation} expenseCurrency={expenseCurrency} />
    </div>
  )
}

function SplitStatus({
  method,
  calculation,
  expenseCurrency,
}: {
  method: SplitMethod
  calculation: SplitCalculation
  expenseCurrency: string
}) {
  if (method === 'custom' && calculation.assigned + calculation.remaining > 0) {
    const { remaining } = calculation
    return (
      <p
        aria-live="polite"
        className={cn(
          'mt-2 text-sm font-semibold tabular-nums',
          remaining === 0 ? 'text-emerald-700' : remaining > 0 ? 'text-orange-700' : 'text-red-600',
        )}
      >
        {remaining === 0
          ? 'All assigned ✓'
          : remaining > 0
            ? `${formatMoney(remaining, expenseCurrency)} left to assign`
            : `${formatMoney(-remaining, expenseCurrency)} over the total`}
      </p>
    )
  }
  if (method === 'percentage') {
    const { remaining } = calculation
    const left = (remaining / 100).toFixed(2).replace(/\.00$/, '')
    return (
      <p
        aria-live="polite"
        className={cn(
          'mt-2 text-sm font-semibold tabular-nums',
          remaining === 0 && calculation.ok
            ? 'text-emerald-700'
            : remaining > 0
              ? 'text-orange-700'
              : 'text-red-600',
        )}
      >
        {calculation.ok
          ? 'Adds up to 100% ✓'
          : remaining > 0
            ? `${left}% left to assign`
            : remaining < 0
              ? `${left.replace('-', '')}% over 100%`
              : calculation.error}
      </p>
    )
  }
  if (!calculation.ok && calculation.error && method === 'shares') {
    return <p className="mt-2 text-sm font-semibold text-red-600">{calculation.error}</p>
  }
  return null
}
