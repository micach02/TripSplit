import { useNavigate, useSearchParams } from 'react-router'
import { Luggage, Wallet, type LucideIcon } from 'lucide-react'
import { TripForm } from '@/components/trips/TripForm'
import { emptyTripFormValues, type CoverChange } from '@/components/trips/tripFormValues'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { useCurrentUser } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'
import { DEFAULT_CURRENCY } from '@/lib/currencies'
import { paths, tripPath } from '@/routes/paths'
import { createTrip, type TripInput } from '@/services/tripService'
import { resizeImage } from '@/utils/image'
import type { TripKind } from '@/utils/tripKind'
import { initialTripStatus } from '@/utils/tripStatus'

const CHOICES: Array<{ kind: TripKind; icon: LucideIcon; title: string; description: string }> = [
  {
    kind: 'budget',
    icon: Wallet,
    title: 'Monthly budget',
    description: 'Groceries, food, bills — alone or with your household. Starts fresh every month.',
  },
  {
    kind: 'trip',
    icon: Luggage,
    title: 'Trip',
    description: 'Dates, a destination and one budget for the whole trip, split with your travel buddies.',
  },
]

export default function CreateTripPage() {
  const { profile } = useCurrentUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const kind: TripKind = searchParams.get('kind') === 'budget' ? 'budget' : 'trip'

  async function handleSubmit(input: TripInput, cover: CoverChange) {
    const coverImage = cover.kind === 'replace' ? await resizeImage(cover.file, 1600, 0.82) : null
    const trip = await createTrip(input, initialTripStatus(input.startDate), coverImage)
    if (trip.kind === 'budget') {
      // Budgets are often just for you: go straight to it rather than to inviting people.
      toast.success(`${trip.name} is ready — add your first expense.`)
      navigate(tripPath(trip.id), { replace: true })
    } else {
      toast.success(`${trip.name} is ready — now invite your travel buddies!`)
      navigate(tripPath(trip.id, 'people'), { replace: true })
    }
  }

  return (
    <>
      <PageTitle title={kind === 'budget' ? 'New budget' : 'Create a Trip'} />
      <PageHeader title="Create" description="Track everyday spending month by month, or plan a trip." />

      <div className="max-w-2xl space-y-6">
        <div role="radiogroup" aria-label="What are you creating?" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHOICES.map((choice) => {
            const selected = choice.kind === kind
            const Icon = choice.icon
            return (
              <button
                key={choice.kind}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSearchParams(choice.kind === 'budget' ? { kind: 'budget' } : {}, { replace: true })}
                className={cn(
                  'flex items-start gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 transition',
                  selected ? 'ring-2 ring-blue-600' : 'ring-slate-900/5 hover:ring-slate-300',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    selected ? 'bg-brand-600 text-white' : 'bg-blue-50 text-blue-600',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold text-slate-900">{choice.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{choice.description}</span>
                </span>
              </button>
            )
          })}
        </div>

        <Card>
          <CardBody>
            <TripForm
              // A fresh form when switching between budget and trip
              key={kind}
              initial={emptyTripFormValues(profile?.preferred_currency ?? DEFAULT_CURRENCY, kind)}
              submitLabel={kind === 'budget' ? 'Create budget' : 'Create trip'}
              onSubmit={handleSubmit}
              onCancel={() => navigate(paths.trips)}
            />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
