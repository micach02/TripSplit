import { useState } from 'react'
import { CirclePlus, Luggage } from 'lucide-react'
import { PendingInvitationsBanner } from '@/components/members/PendingInvitationsBanner'
import { TripCard } from '@/components/trips/TripCard'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'
import { listTrips, type TripListItem } from '@/services/tripService'
import type { TripStatus } from '@/types/models'
import { TRIP_STATUS_LABELS } from '@/utils/tripStatus'

type Filter = 'all' | TripStatus
const FILTERS: Filter[] = ['all', 'active', 'upcoming', 'completed']
const RANK: Record<TripStatus, number> = { active: 0, upcoming: 1, completed: 2 }

/** Active first, then upcoming (soonest first), then completed (most recent first). */
function sortTrips(trips: TripListItem[]): TripListItem[] {
  return [...trips].sort((a, b) => {
    const rank = RANK[a.effectiveStatus] - RANK[b.effectiveStatus]
    if (rank !== 0) return rank
    return a.effectiveStatus === 'upcoming'
      ? a.start_date.localeCompare(b.start_date)
      : b.start_date.localeCompare(a.start_date)
  })
}

function TripGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div key={key} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5">
          <div className="h-32 animate-pulse bg-slate-100" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-2 w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TripsPage() {
  const { data: trips, error, reload } = useAsync(listTrips)
  const [filter, setFilter] = useState<Filter>('all')

  const sorted = trips ? sortTrips(trips) : []
  const visible = filter === 'all' ? sorted : sorted.filter((trip) => trip.effectiveStatus === filter)
  const count = (value: Filter) =>
    value === 'all' ? sorted.length : sorted.filter((trip) => trip.effectiveStatus === value).length

  return (
    <>
      <PageTitle title="My Trips" />
      <PageHeader
        title="My Trips"
        description="All your adventures in one place."
        actions={
          <ButtonLink to={paths.newTrip} icon={<CirclePlus className="size-5" aria-hidden />}>
            Create trip
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        <PendingInvitationsBanner onAccepted={reload} />

        {error && !trips ? (
          <Alert tone="error" title="We couldn't load your trips">
            <p>{getErrorMessage(error)}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              Try again
            </Button>
          </Alert>
        ) : !trips ? (
          <TripGridSkeleton />
        ) : trips.length === 0 ? (
          <Card>
            <EmptyState
              icon={Luggage}
              title="No trips yet."
              description="Your next adventure starts here."
              action={
                <ButtonLink to={paths.newTrip} size="lg" icon={<CirclePlus className="size-5" aria-hidden />}>
                  Create Trip
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <>
            <div role="tablist" aria-label="Filter trips" className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
                    filter === value
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {value === 'all' ? 'All' : TRIP_STATUS_LABELS[value]}
                  <span className={cn('text-xs tabular-nums', filter === value ? 'text-white/70' : 'text-slate-400')}>
                    {count(value)}
                  </span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-900/5">
                No {filter === 'all' ? '' : TRIP_STATUS_LABELS[filter as TripStatus].toLowerCase()} trips.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
