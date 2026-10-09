import { useMemo } from 'react'
import { Outlet, useParams } from 'react-router'
import { MapPinOff } from 'lucide-react'
import { TripHeader } from '@/components/trips/TripHeader'
import { TripTabs } from '@/components/trips/TripTabs'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { useCurrentUser } from '@/hooks/useAuth'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'
import { buildTripContext } from '@/hooks/useTripContext'
import { useTripData } from '@/hooks/useTripData'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'
import { TripNotFoundError } from '@/services/tripService'

/** Loads one trip and renders its header, tabs and the active tab. */
export default function TripLayout() {
  const { tripId = '' } = useParams()
  const { user } = useCurrentUser()
  const { data, error, reload } = useTripData(tripId)
  const { money, requested, setDisplayCurrency } = useDisplayCurrency(tripId, data?.trip.currency ?? '')
  const context = useMemo(
    () =>
      data
        ? buildTripContext(data, user.id, reload, { money, requestedCurrency: requested, setDisplayCurrency })
        : null,
    [data, user.id, reload, money, requested, setDisplayCurrency],
  )

  if (error instanceof TripNotFoundError) {
    return (
      <Card>
        <PageTitle title="Trip not found" />
        <EmptyState
          icon={MapPinOff}
          title="Trip not found"
          description="It may have been deleted, or you're not a member of it."
          action={<ButtonLink to={paths.trips}>Back to My Trips</ButtonLink>}
        />
      </Card>
    )
  }

  if (error && !context) {
    return (
      <Alert tone="error" title="We couldn't load this trip">
        <p>{getErrorMessage(error)}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
          Try again
        </Button>
      </Alert>
    )
  }

  if (!context) return <PageLoader label="Loading trip…" />

  return (
    <>
      <PageTitle title={context.trip.name} />
      <TripHeader context={context} />
      <TripTabs tripId={context.trip.id} />
      <div className="mt-6">
        <Outlet context={context} />
      </div>
    </>
  )
}
