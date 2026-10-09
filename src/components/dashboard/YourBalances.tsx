import { Link } from 'react-router'
import { ChevronRight, PartyPopper } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { tripPath } from '@/routes/paths'
import type { DashboardSummary } from '@/services/dashboardService'
import { formatMoney } from '@/utils/calculations/money'

/** What I owe / am owed, per trip, with a converted grand total. */
export function YourBalances({ summary }: { summary: DashboardSummary }) {
  const { balances, balanceTotals, currency } = summary

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Your balances"
        description={
          balances.length > 0
            ? [
                balanceTotals.owedToMe > 0 && `You're owed ${formatMoney(balanceTotals.owedToMe, currency)}`,
                balanceTotals.iOwe > 0 && `you owe ${formatMoney(balanceTotals.iOwe, currency)}`,
              ]
                .filter(Boolean)
                .join(' · ')
                .replace(/^you/, 'You') + (balanceTotals.complete ? '' : ' (some trips not converted)')
            : undefined
        }
      />
      <div className="mt-3">
        {balances.length === 0 ? (
          <div className="flex items-center gap-3 px-5 pb-6 sm:px-6">
            <PartyPopper className="size-5 text-emerald-600" aria-hidden />
            <p className="text-sm text-slate-600">You&apos;re all settled up across your trips.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {balances.map((balance) => (
              <li key={balance.tripId}>
                <Link
                  to={tripPath(balance.tripId, 'balances')}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{balance.tripName}</span>
                  <span className="text-right">
                    <span
                      className={cn(
                        'block text-sm font-bold tabular-nums',
                        balance.net > 0 ? 'text-emerald-700' : 'text-red-700',
                      )}
                    >
                      {formatMoney(Math.abs(balance.net), balance.currency)}
                    </span>
                    <span className="block text-xs text-slate-500">{balance.net > 0 ? "you're owed" : 'you owe'}</span>
                  </span>
                  <ChevronRight className="size-4 text-slate-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
