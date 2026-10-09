import { Link } from 'react-router'
import { CalendarDays, MapPin } from 'lucide-react'
import { MemberStack } from '@/components/members/MemberStack'
import { TripCover } from '@/components/trips/TripCover'
import { TripStatusBadge } from '@/components/trips/TripStatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/cn'
import { tripPath } from '@/routes/paths'
import type { TripListItem } from '@/services/tripService'
import { budgetTone, getBudgetUsage } from '@/utils/calculations/budgetCalculator'
import { formatMoney } from '@/utils/calculations/money'
import { formatDateRange } from '@/utils/format'

export function TripCard({ trip }: { trip: TripListItem }) {
  const usage = getBudgetUsage(trip.spentMinor, trip.budgetMinor)
  const tone = budgetTone(usage)

  return (
    <Link
      to={tripPath(trip.id)}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2"
    >
      <div className="relative">
        <TripCover tripId={trip.id} name={trip.name} url={trip.coverUrl} className="h-32 sm:h-36" />
        <TripStatusBadge status={trip.effectiveStatus} className="absolute top-3 left-3 shadow-sm ring-white/60" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-blue-700">{trip.name}</h3>
        <div className="mt-1 space-y-0.5 text-sm text-slate-500">
          {trip.destination && (
            <p className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{trip.destination}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
            {formatDateRange(trip.start_date, trip.end_date)}
          </p>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 tabular-nums">{formatMoney(trip.spentMinor, trip.currency)}</p>
            <p className="text-xs text-slate-500 tabular-nums">
              {trip.budgetMinor > 0 ? `of ${formatMoney(trip.budgetMinor, trip.currency)}` : 'No budget set'}
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
