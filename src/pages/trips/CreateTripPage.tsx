import { useNavigate } from 'react-router'
import { TripForm } from '@/components/trips/TripForm'
import { emptyTripFormValues, type CoverChange } from '@/components/trips/tripFormValues'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { useCurrentUser } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { DEFAULT_CURRENCY } from '@/lib/currencies'
import { paths, tripPath } from '@/routes/paths'
import { createTrip, type TripInput } from '@/services/tripService'
import { resizeImage } from '@/utils/image'
import { initialTripStatus } from '@/utils/tripStatus'

export default function CreateTripPage() {
  const { profile } = useCurrentUser()
  const navigate = useNavigate()
  const toast = useToast()

  async function handleSubmit(input: TripInput, cover: CoverChange) {
    const coverImage = cover.kind === 'replace' ? await resizeImage(cover.file, 1600, 0.82) : null
    const trip = await createTrip(input, initialTripStatus(input.startDate), coverImage)
    toast.success(`${trip.name} is ready — now invite your travel buddies!`)
    navigate(tripPath(trip.id, 'people'), { replace: true })
  }

  return (
    <>
      <PageTitle title="Create a Trip" />
      <PageHeader title="Create a Trip" description="Set the dates and budget — you can invite friends right after." />
      <Card className="max-w-2xl">
        <CardBody>
          <TripForm
            initial={emptyTripFormValues(profile?.preferred_currency ?? DEFAULT_CURRENCY)}
            submitLabel="Create trip"
            onSubmit={handleSubmit}
            onCancel={() => navigate(paths.trips)}
          />
        </CardBody>
      </Card>
    </>
  )
}
