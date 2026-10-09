import { Link } from 'react-router'
import { HandCoins } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { tripPath } from '@/routes/paths'
import { listRecentSettlements, PAYMENT_METHOD_LABELS } from '@/services/settlementService'
import { formatAmount } from '@/utils/calculations/money'
import { firstName, formatDate } from '@/utils/format'

const loadRecent = () => listRecentSettlements(5)

/** The latest payments between travelers, across all trips. */
export function RecentSettlements() {
  const { data, error } = useAsync(loadRecent)

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Recent settlements" />
      <div className="mt-3">
        {error && !data ? (
          <p className="px-5 pb-5 text-sm text-slate-500 sm:px-6">Recent settlements couldn’t be loaded.</p>
        ) : !data ? (
          <div className="flex justify-center py-8 text-blue-600">
            <Spinner />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-4 pb-8 text-center">
            <HandCoins className="size-8 text-slate-300" aria-hidden />
            <p className="mt-2 text-sm text-slate-500">No payments recorded yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((settlement) => (
              <li key={settlement.id}>
                <Link
                  to={tripPath(settlement.tripId, 'settlements')}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <HandCoins className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {firstName(settlement.fromName)} → {firstName(settlement.toName)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {PAYMENT_METHOD_LABELS[settlement.method]} · {settlement.tripName} · {formatDate(settlement.date)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatAmount(settlement.amount, settlement.currency)}
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
