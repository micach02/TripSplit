import { Link } from 'react-router'
import { CalendarDays, ChevronLeft, MapPin, Plus, Users } from 'lucide-react'
import { BudgetSummary } from '@/components/trips/BudgetSummary'
import { ConversionNote, DisplayCurrencyPicker } from '@/components/trips/DisplayCurrencyPicker'
import { TripCover } from '@/components/trips/TripCover'
import { TripStatusBadge } from '@/components/trips/TripStatusBadge'
import { ButtonLink } from '@/components/ui/Button'
import type { TripContextValue } from '@/hooks/useTripContext'
import { newExpensePath, paths } from '@/routes/paths'
import { formatDateRange } from '@/utils/format'

export function TripHeader({ context }: { context: TripContextValue }) {
  const { trip, effectiveStatus, coverUrl, members, budgetMinor, spentMinor, money, requestedCurrency, setDisplayCurrency } =
    context

  return (
    <header>
      <Link
        to={paths.trips}
        className="-ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ChevronLeft className="size-4" aria-hidden />
        My Trips
      </Link>

      <div className="mt-2 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="relative">
          <TripCover tripId={trip.id} name={trip.name} url={coverUrl} size="banner" className="h-40 sm:h-48" />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-white sm:p-6">
            <div className="min-w-0">
              <TripStatusBadge status={effectiveStatus} />
              <h1 className="mt-2 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{trip.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-white/85">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {formatDateRange(trip.start_date, trip.end_date)}
                </span>
                {trip.destination && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {trip.destination}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  {members.length} {members.length === 1 ? 'traveler' : 'travelers'}
                </span>
              </p>
            </div>
            {effectiveStatus !== 'completed' && (
              <ButtonLink
                to={newExpensePath(trip.id)}
                className="shrink-0 max-sm:hidden"
                icon={<Plus className="size-5" aria-hidden />}
              >
                Add expense
              </ButtonLink>
            )}
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          <div className="flex justify-end">
            <DisplayCurrencyPicker money={money} requested={requestedCurrency} onChange={setDisplayCurrency} />
          </div>
          <BudgetSummary budgetMinor={budgetMinor} spentMinor={spentMinor} format={(minor) => money.format(minor)} />
          <ConversionNote money={money} requested={requestedCurrency} />
        </div>
      </div>
    </header>
  )
}
