import { Link } from 'react-router'
import { CalendarDays, ChevronLeft, MapPin, Plus, Settings, TrendingUp, Users, Wallet } from 'lucide-react'
import { BudgetSummary } from '@/components/trips/BudgetSummary'
import { ConversionNote, DisplayCurrencyPicker } from '@/components/trips/DisplayCurrencyPicker'
import { MonthSwitcher } from '@/components/trips/MonthSwitcher'
import { TripCover } from '@/components/trips/TripCover'
import { TripStatusBadge } from '@/components/trips/TripStatusBadge'
import { ButtonLink } from '@/components/ui/Button'
import type { TripContextValue } from '@/hooks/useTripContext'
import { newExpensePath, paths, tripPath } from '@/routes/paths'
import { cn } from '@/lib/cn'
import { forecastMonthEnd } from '@/utils/calculations/insights'
import { formatDate } from '@/utils/format'
import { memberCount, timeframe } from '@/utils/tripKind'
import { todayIso } from '@/utils/tripStatus'

export function TripHeader({ context }: { context: TripContextValue }) {
  const {
    trip,
    effectiveStatus,
    coverUrl,
    members,
    budgetMinor,
    periodSpentMinor,
    money,
    requestedCurrency,
    setDisplayCurrency,
    isBudget,
    period,
    monthRange,
    setMonth,
    availableMinor,
    carryMinor,
    copy,
  } = context
  const forecast = period ? forecastMonthEnd(periodSpentMinor, period, todayIso()) : null
  const forecastOver = forecast && availableMinor > 0 ? forecast.projectedMinor - availableMinor : 0

  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <Link
          to={paths.trips}
          className="tap-target -ml-1 inline-flex items-center gap-1 rounded-lg px-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Budgets & Trips
        </Link>
        <Link
          to={tripPath(trip.id, 'settings')}
          className="tap-target inline-flex items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
          aria-label={`${copy.Noun} settings`}
        >
          <Settings className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Settings</span>
        </Link>
      </div>

      <div className="mt-2 overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-slate-900/5">
        <div className="relative">
          <TripCover tripId={trip.id} name={trip.name} url={coverUrl} kind={trip.kind} size="banner" className="h-44 sm:h-52" />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-scrim/75 via-scrim/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-white sm:p-6">
            <div className="min-w-0">
              <TripStatusBadge status={effectiveStatus} kind={trip.kind} />
              <h1 className="mt-2 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{trip.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-white/85">
                <span className="inline-flex items-center gap-1">
                  {isBudget ? (
                    <Wallet className="size-3.5" aria-hidden />
                  ) : (
                    <CalendarDays className="size-3.5" aria-hidden />
                  )}
                  {timeframe({ kind: trip.kind, startDate: trip.start_date, endDate: trip.end_date })}
                </span>
                {trip.destination && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {trip.destination}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  {memberCount(trip.kind, members.length)}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            {period && monthRange ? (
              <MonthSwitcher period={period} range={monthRange} onChange={setMonth} className="-ml-2" />
            ) : (
              <span />
            )}
            <DisplayCurrencyPicker money={money} requested={requestedCurrency} onChange={setDisplayCurrency} />
          </div>
          <BudgetSummary
            budgetMinor={isBudget ? availableMinor : budgetMinor}
            spentMinor={periodSpentMinor}
            format={(minor) => money.format(minor)}
            budgetLabel={isBudget ? 'Monthly budget' : 'Budget'}
            // Past months are history; warnings are for the month you're in.
            showWarning={!isBudget || period?.month === monthRange?.latest}
          />
          {isBudget && carryMinor !== 0 && (
            <p className="text-xs text-slate-500">
              {carryMinor > 0
                ? `Includes ${money.format(carryMinor)} left over from earlier months.`
                : `${money.format(Math.min(-carryMinor, budgetMinor))} less this month: earlier months went over.`}
            </p>
          )}
          {forecast && periodSpentMinor > 0 && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-sm',
                forecastOver > 0 ? 'font-semibold text-orange-700' : 'text-slate-600',
              )}
            >
              <TrendingUp className="size-4 shrink-0" aria-hidden />
              <span>
                At this pace: {money.format(forecast.projectedMinor)} by {formatDate(period?.end ?? '')}
                {forecastOver > 0 && ` — ${money.format(forecastOver)} over`}
                {forecast.early && <span className="font-normal text-slate-500"> (early estimate)</span>}
              </span>
            </p>
          )}
          <ConversionNote money={money} requested={requestedCurrency} />
        </div>
      </div>
    </header>
  )
}
