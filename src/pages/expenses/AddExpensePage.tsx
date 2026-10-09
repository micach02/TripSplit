import { Link, Navigate } from 'react-router'
import { ChevronRight, CirclePlus, Luggage } from 'lucide-react'
import { TripCover } from '@/components/trips/TripCover'
import { TripStatusBadge } from '@/components/trips/TripStatusBadge'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/errors'
import { newExpensePath, paths } from '@/routes/paths'
import { listTrips } from '@/services/tripService'
import { formatDateRange } from '@/utils/format'

/** Entry point from the "+" button: pick the trip, or go straight there if there's only one. */
export default function AddExpensePage() {
  const { data: trips, error } = useAsync(listTrips)

  if (error && !trips) {
    return <Alert tone="error" title="We couldn't load your trips">{getErrorMessage(error)}</Alert>
  }
  if (!trips) return <PageLoader />

  const open = trips
    .filter((trip) => trip.effectiveStatus !== 'completed')
    .sort((a, b) =>
      a.effectiveStatus === b.effectiveStatus
        ? a.start_date.localeCompare(b.start_date)
        : a.effectiveStatus === 'active'
          ? -1
          : 1,
    )

  if (open.length === 1) return <Navigate to={newExpensePath(open[0].id)} replace />

  return (
    <>
      <PageTitle title="Add Expense" />
      <PageHeader title="Add Expense" description="Which trip is this for?" />
      {open.length === 0 ? (
        <Card>
          <EmptyState
            icon={Luggage}
            title="No trips to add expenses to"
            description="Create a trip first — then logging an expense takes seconds."
            action={
              <ButtonLink to={paths.newTrip} icon={<CirclePlus className="size-5" aria-hidden />}>
                Create Trip
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {open.map((trip) => (
            <li key={trip.id}>
              <Link
                to={newExpensePath(trip.id)}
                className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5 transition hover:ring-blue-300"
              >
                <TripCover tripId={trip.id} name={trip.name} url={trip.coverUrl} className="size-16 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{trip.name}</p>
                  <p className="truncate text-sm text-slate-500">{formatDateRange(trip.start_date, trip.end_date)}</p>
                  <TripStatusBadge status={trip.effectiveStatus} className="mt-1" />
                </div>
                <ChevronRight className="size-5 shrink-0 text-slate-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
