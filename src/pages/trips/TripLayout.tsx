import { useCallback, useMemo } from 'react'
import { Outlet, useParams, useSearchParams } from 'react-router'
import { MapPinOff } from 'lucide-react'
import { TripHeader } from '@/components/trips/TripHeader'
import { TripTabs } from '@/components/trips/TripTabs'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/PageHeader'
import { TripPageSkeleton } from '@/components/ui/Skeleton'
import { useCurrentUser } from '@/hooks/useAuth'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'
import { buildTripContext } from '@/hooks/useTripContext'
import { useTripData } from '@/hooks/useTripData'
import { useDataChanged } from '@/lib/dataEvents'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'
import { TripNotFoundError } from '@/services/tripService'
import { parseMonth } from '@/utils/budgetPeriod'

/** Loads one trip or budget and renders its header, tabs and the active tab. */
export default function TripLayout() {
  const { tripId = '' } = useParams()
  const { user } = useCurrentUser()
  const { data, error, reload } = useTripData(tripId)
  const { money, requested, setDisplayCurrency } = useDisplayCurrency(tripId, data?.trip.currency ?? '')
  // Recurring expenses added or offline expenses synced: refresh the totals.
  useDataChanged(reload)

  // Budgets: the month being viewed lives in the URL (?month=2026-09), so it
  // survives reloads, can be shared, and follows you across the tabs.
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMonth = parseMonth(searchParams.get('month'))
  const setMonth = useCallback(
    (month: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('month', month)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const context = useMemo(
    () =>
      data
        ? buildTripContext(data, user.id, reload, {
            money,
            requestedCurrency: requested,
            setDisplayCurrency,
            month: requestedMonth,
            setMonth,
          })
        : null,
    [data, user.id, reload, money, requested, setDisplayCurrency, requestedMonth, setMonth],
  )

  if (error instanceof TripNotFoundError) {
    return (
      <Card>
        <PageTitle title="Not found" />
        <EmptyState
          headingLevel={1}
          icon={MapPinOff}
          emoji="🏝️"
          title="We couldn’t find that"
          description="This trip or budget may have been deleted, or you’re not a member of it."
          action={<ButtonLink to={paths.trips}>Back to Budgets & Trips</ButtonLink>}
        />
      </Card>
    )
  }

  if (error && !context) {
    return (
      <Alert tone="error" title="We couldn't load this page">
        <p>{getErrorMessage(error)}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
          Try again
        </Button>
      </Alert>
    )
  }

  if (!context) return <TripPageSkeleton />

  return (
    <>
      <PageTitle title={context.period ? `${context.trip.name} · ${context.period.shortLabel}` : context.trip.name} />
      <TripHeader context={context} />
      <TripTabs
        tripId={context.trip.id}
        label={`${context.copy.Noun} sections`}
        // Nothing to settle when you're the only one in it
        showSettleUp={context.members.length > 1}
        search={requestedMonth ? `?month=${requestedMonth}` : ''}
      />
      <div className="mt-6">
        <Outlet context={context} />
      </div>
    </>
  )
}
