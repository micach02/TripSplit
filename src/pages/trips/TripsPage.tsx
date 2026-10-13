import { useState } from 'react'
import { CirclePlus, Luggage, Wallet } from 'lucide-react'
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
import { newBudgetPath, paths } from '@/routes/paths'
import { listTripsOfflineFirst, type TripListItem } from '@/services/tripService'
type Filter = 'all' | 'budgets' | 'trips' | 'archived'
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'budgets', label: 'Budgets' },
  { value: 'trips', label: 'Trips' },
  { value: 'archived', label: 'Completed & archived' },
]

const matches: Record<Filter, (trip: TripListItem) => boolean> = {
  all: () => true,
  budgets: (trip) => trip.kind === 'budget' && trip.effectiveStatus !== 'completed',
  trips: (trip) => trip.kind === 'trip' && trip.effectiveStatus !== 'completed',
  archived: (trip) => trip.effectiveStatus === 'completed',
}

/** Trips happening now, then budgets, then upcoming trips (soonest first), then finished ones (most recent first). */
function rank(trip: TripListItem): number {
  if (trip.effectiveStatus === 'completed') return 3
  if (trip.kind === 'budget') return 1
  return trip.effectiveStatus === 'active' ? 0 : 2
}

function sortTrips(trips: TripListItem[]): TripListItem[] {
  return [...trips].sort((a, b) => {
    const difference = rank(a) - rank(b)
    if (difference !== 0) return difference
    if (a.kind === 'budget' && b.kind === 'budget') return a.name.localeCompare(b.name)
    return rank(a) === 2 ? a.start_date.localeCompare(b.start_date) : b.start_date.localeCompare(a.start_date)
  })
}

function TripGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div key={key} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-slate-900/5">
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
  const { data: trips, error, reload } = useAsync(listTripsOfflineFirst)
  const [filter, setFilter] = useState<Filter>('all')

  const sorted = trips ? sortTrips(trips) : []
  const visible = sorted.filter(matches[filter])
  const count = (value: Filter) => sorted.filter(matches[value]).length

  return (
    <>
      <PageTitle title="Budgets & Trips" />
      <PageHeader
        title="Budgets & Trips"
        description="Everyday budgets and trips, all in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={newBudgetPath} icon={<Wallet className="size-5" aria-hidden />}>
              New budget
            </ButtonLink>
            <ButtonLink to={paths.newTrip} variant="outline" icon={<CirclePlus className="size-5" aria-hidden />}>
              New trip
            </ButtonLink>
          </div>
        }
      />

      <div className="space-y-6">
        <PendingInvitationsBanner onAccepted={reload} />

        {error && !trips ? (
          <Alert tone="error" title="We couldn't load your budgets and trips">
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
              title="Nothing here yet."
              description="Start a monthly budget for groceries and bills, or plan your next adventure."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink to={newBudgetPath} size="lg" icon={<Wallet className="size-5" aria-hidden />}>
                    Create a budget
                  </ButtonLink>
                  <ButtonLink to={paths.newTrip} size="lg" variant="outline" icon={<CirclePlus className="size-5" aria-hidden />}>
                    Plan a trip
                  </ButtonLink>
                </div>
              }
            />
          </Card>
        ) : (
          <>
            <div role="tablist" aria-label="Filter budgets and trips" className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors sm:h-10',
                    filter === value
                      ? 'bg-slate-900 text-slate-50'
                      : 'bg-surface text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {label}
                  <span className={cn('text-xs tabular-nums', filter === value ? 'text-slate-50/90' : 'text-slate-500')}>
                    {count(value)}
                  </span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="rounded-2xl bg-surface px-5 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-900/5">
                {filter === 'budgets'
                  ? 'No budgets yet.'
                  : filter === 'trips'
                    ? 'No current or upcoming trips.'
                    : filter === 'archived'
                      ? 'Nothing completed or archived yet.'
                      : 'Nothing here.'}
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
