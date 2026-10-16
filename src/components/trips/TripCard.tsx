import { Link } from 'react-router'
import { CalendarDays, MapPin, Wallet } from 'lucide-react'
import { MemberStack } from '@/components/members/MemberStack'
import { TripCover } from '@/components/trips/TripCover'
import { TripStatusBadge } from '@/components/trips/TripStatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/cn'
import { tripPath } from '@/routes/paths'
import type { TripListItem } from '@/services/tripService'
import { budgetTone, getBudgetUsage } from '@/utils/calculations/budgetCalculator'
import { formatMoney } from '@/utils/calculations/money'
import { timeframe } from '@/utils/tripKind'

export function TripCard({ trip }: { trip: TripListItem }) {
  const usage = getBudgetUsage(trip.spentMinor, trip.budgetMinor)
  const tone = budgetTone(usage)

  return (
    <Link
      to={tripPath(trip.id)}
      className="group flex flex-col overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2"
    >
      <div className="relative">
        <TripCover tripId={trip.id} name={trip.name} url={trip.coverUrl} kind={trip.kind} className="h-32 sm:h-36" />
        <TripStatusBadge status={trip.effectiveStatus} kind={trip.kind} className="absolute top-3 left-3 shadow-sm ring-white/60" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="truncate text-base font-bold text-slate-900 group-hover:text-primary-700">{trip.name}</h2>
        <div className="mt-1 space-y-0.5 text-sm text-slate-500">
          {trip.destination && (
            <p className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{trip.destination}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5">
            {trip.kind === 'budget' ? (
              <Wallet className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <CalendarDays className="size-3.5 shrink-0" aria-hidden />
            )}
            {timeframe({ kind: trip.kind, startDate: trip.start_date, endDate: trip.end_date })}
          </p>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 tabular-nums">{formatMoney(trip.spentMinor, trip.currency)}</p>
            <p className="text-xs text-slate-500 tabular-nums">
              {trip.budgetMinor > 0
                ? `of ${formatMoney(trip.budgetMinor, trip.currency)}${trip.kind === 'budget' ? ' this month' : ''}`
                : trip.kind === 'budget'
                  ? 'this month'
                  : 'No budget set'}
            </p>
          </div>
          <MemberStack members={trip.members} max={3} />
        </div>
        {usage.percentUsed !== null && (
          <ProgressBar
            value={usage.percentUsed}
            tone={tone}
            label={`${usage.percentUsed}% of budget spent`}
            className={cn('mt-3')}
          />
        )}
      </div>
    </Link>
  )
}
