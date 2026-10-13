import { Link, Navigate, useSearchParams } from 'react-router'
import { ChevronRight, CirclePlus, Luggage } from 'lucide-react'
import { TripCover } from '@/components/trips/TripCover'
import { TripStatusBadge } from '@/components/trips/TripStatusBadge'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { useAsync } from '@/hooks/useAsync'
import { useCurrentUser } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/errors'
import { newBudgetPath, newExpensePath, paths } from '@/routes/paths'
import { listTripsOfflineFirst } from '@/services/tripService'
import { timeframe } from '@/utils/tripKind'

/**
 * Entry point from the "+" button: straight to your default budget (Settings),
 * or the only open one; otherwise pick. ?choose=1 always shows the list.
 */
export default function AddExpensePage() {
  const { data: trips, error } = useAsync(listTripsOfflineFirst)
  const { profile } = useCurrentUser()
  const [searchParams] = useSearchParams()
  const choosing = searchParams.has('choose')

  if (error && !trips) {
    return <Alert tone="error" title="We couldn't load your budgets and trips">{getErrorMessage(error)}</Alert>
  }
  if (!trips) return <PageSkeleton label="Loading your budgets and trips…" />

  // Trips happening now first, then everyday budgets, then upcoming trips.
  const rank = (trip: (typeof trips)[number]) =>
    trip.kind === 'budget' ? 1 : trip.effectiveStatus === 'active' ? 0 : 2
  const open = trips
    .filter((trip) => trip.effectiveStatus !== 'completed')
    .sort((a, b) => rank(a) - rank(b) || a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name))

  const preferred = choosing ? undefined : (open.find((trip) => trip.id === profile?.default_trip_id) ?? (open.length === 1 ? open[0] : undefined))
  if (preferred) return <Navigate to={newExpensePath(preferred.id)} replace state={{ quickAdd: open.length > 1 }} />

  return (
    <>
      <PageTitle title="Add Expense" />
      <PageHeader title="Add Expense" description="Which budget or trip is this for?" />
      {open.length === 0 ? (
        <Card>
          <EmptyState
            icon={Luggage}
            title="Nothing to add expenses to yet"
            description="Create a monthly budget or a trip first — then logging an expense takes seconds."
            action={
              <ButtonLink to={newBudgetPath} icon={<CirclePlus className="size-5" aria-hidden />}>
                Create a budget
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
                className="flex items-center gap-4 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-slate-900/5 transition hover:ring-blue-300"
              >
                <TripCover tripId={trip.id} name={trip.name} url={trip.coverUrl} className="size-16 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{trip.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {timeframe({ kind: trip.kind, startDate: trip.start_date, endDate: trip.end_date })}
                  </p>
                  <TripStatusBadge status={trip.effectiveStatus} kind={trip.kind} className="mt-1" />
                </div>
                <ChevronRight className="size-5 shrink-0 text-slate-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open.length > 1 && !profile?.default_trip_id && (
        <p className="mt-6 text-sm text-slate-500">
          Tip: choose a default in{' '}
          <Link to={`${paths.settings}#quick-add`} className="font-semibold text-blue-600 hover:text-blue-700">
            Settings
          </Link>{' '}
          and the + button will open it straight away.
        </p>
      )}
    </>
  )
}
