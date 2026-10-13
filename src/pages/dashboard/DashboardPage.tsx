import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CirclePlus, Luggage, PiggyBank, Plane, Wallet, WalletMinimal } from 'lucide-react'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { RecentSettlements } from '@/components/dashboard/RecentSettlements'
import { YourBalances } from '@/components/dashboard/YourBalances'
import { StatCard, StatCardSkeleton } from '@/components/dashboard/StatCard'
import { PendingInvitationsBanner } from '@/components/members/PendingInvitationsBanner'
import { CurrencyViewPicker } from '@/components/trips/DisplayCurrencyPicker'
import { TripBudgetRow } from '@/components/trips/TripBudgetRow'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useCurrentUser } from '@/hooks/useAuth'
import { DEFAULT_CURRENCY, isCurrencyCode } from '@/lib/currencies'
import { useDataChanged } from '@/lib/dataEvents'
import { getErrorMessage } from '@/lib/errors'
import { newBudgetPath, paths } from '@/routes/paths'
import { getDashboardSummaryOfflineFirst, type DashboardSummary } from '@/services/dashboardService'
import { formatMoney } from '@/utils/calculations/money'
import { firstName } from '@/utils/format'

const VIEW_CURRENCY_KEY = 'tripsplit:dashboard-currency'

function readViewCurrency(): string | null {
  try {
    const value = window.localStorage.getItem(VIEW_CURRENCY_KEY)
    return value && isCurrencyCode(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers a "View in" choice; choosing the preferred currency clears it so Settings stays in charge. */
function storeViewCurrency(value: string | null): void {
  try {
    if (value) window.localStorage.setItem(VIEW_CURRENCY_KEY, value)
    else window.localStorage.removeItem(VIEW_CURRENCY_KEY)
  } catch {
    // Remembering the choice is a convenience only.
  }
}

function Overview({
  summary,
  preferredCurrency,
  picker,
}: {
  summary: DashboardSummary
  preferredCurrency: string
  picker: ReactNode
}) {
  const { currency, totals, activeTrips, convertedTripCount, unconvertedTripCount } = summary
  const overBudget = totals.remaining < 0

  return (
    <section aria-label="Overview">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">At a glance</h2>
        {picker}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active" value={activeTrips.length} icon={Plane} tone="primary" hint="budgets & trips" />
        <StatCard label="Total Spent" value={formatMoney(totals.spent, currency)} icon={Wallet} />
        <StatCard label="Total Budget" value={formatMoney(totals.budget, currency)} icon={PiggyBank} />
        <StatCard
          label={overBudget ? 'Over Budget' : 'Remaining'}
          value={formatMoney(Math.abs(totals.remaining), currency)}
          icon={WalletMinimal}
          tone={overBudget ? 'negative' : 'positive'}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {currency === preferredCurrency ? (
          <>
            Totals in {currency} (your{' '}
            <Link to={paths.settings} className="font-semibold text-blue-600 hover:text-blue-700">
              preferred currency
            </Link>
            ).
          </>
        ) : (
          <>
            Totals shown in {currency}; your{' '}
            <Link to={paths.settings} className="font-semibold text-blue-600 hover:text-blue-700">
              preferred currency
            </Link>{' '}
            is {preferredCurrency}.
          </>
        )}
        {convertedTripCount > 0 &&
          ` ${convertedTripCount === 1 ? '1 budget or trip was' : `${convertedTripCount} were`} converted at today's exchange rate.`}
        {unconvertedTripCount > 0 &&
          ` ${unconvertedTripCount === 1 ? '1 budget or trip isn’t' : `${unconvertedTripCount} aren’t`} included — exchange rates couldn’t be loaded.`}
      </p>
    </section>
  )
}

export default function DashboardPage() {
  const { user, profile, displayName } = useCurrentUser()
  const preferredCurrency = profile?.preferred_currency ?? DEFAULT_CURRENCY
  const [viewCurrency, setViewCurrency] = useState<string | null>(readViewCurrency)
  const currency = viewCurrency ?? preferredCurrency
  const load = useCallback(() => getDashboardSummaryOfflineFirst(currency, user.id), [currency, user.id])
  const { data: summary, error, loading, reload } = useAsync(load)
  useDataChanged(reload)

  function changeViewCurrency(code: string) {
    const choice = code === preferredCurrency ? null : code
    setViewCurrency(choice)
    storeViewCurrency(choice)
  }

  const picker = (
    <CurrencyViewPicker
      value={currency}
      onChange={changeViewCurrency}
      homeCurrency={preferredCurrency}
      homeLabel="yours"
      loading={loading && Boolean(summary)}
    />
  )

  return (
    <>
      <PageTitle title="Dashboard" />
      <PageHeader
        title={`Welcome back, ${firstName(displayName) || 'traveler'} 👋`}
        description="Everyday budgets and trips, simplified."
        actions={
          <ButtonLink to={paths.newTrip} className="max-sm:hidden" icon={<CirclePlus className="size-5" aria-hidden />}>
            Create
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        <PendingInvitationsBanner onAccepted={reload} />

        {error ? (
          <Alert tone="error" title="We couldn't load your dashboard">
            <p>{getErrorMessage(error)}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              Try again
            </Button>
          </Alert>
        ) : !summary ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy="true">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <span className="sr-only" role="status">
              Loading your dashboard…
            </span>
          </div>
        ) : (
          <>
            <Overview summary={summary} preferredCurrency={preferredCurrency} picker={picker} />

            {summary.tripCount === 0 ? (
              <Card>
                <EmptyState
                  icon={Luggage}
                  title="Nothing here yet."
                  description="Start a monthly budget for groceries, food and bills — or plan a trip with friends. TripSplit keeps score."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <ButtonLink to={newBudgetPath} size="lg" icon={<CirclePlus className="size-5" aria-hidden />}>
                        Create a budget
                      </ButtonLink>
                      <ButtonLink to={paths.newTrip} size="lg" variant="outline">
                        Plan a trip
                      </ButtonLink>
                    </div>
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Card>
                  <CardHeader
                    title="Budgets & trips"
                    description={
                      summary.activeTrips.length > 0 ? 'Budgets show this month; trips show the whole trip.' : undefined
                    }
                    action={
                      <Link to={paths.trips} className="tap-target shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-700">
                        See all
                      </Link>
                    }
                  />
                  <CardBody>
                    {summary.activeTrips.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {summary.activeTrips.map((trip) => (
                          <TripBudgetRow key={trip.id} trip={trip} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Nothing running right now.{' '}
                        <Link to={paths.trips} className="font-semibold text-blue-600 hover:text-blue-700">
                          See upcoming trips and archived budgets
                        </Link>
                        .
                      </p>
                    )}
                  </CardBody>
                </Card>
                <RecentExpenses />
              </div>
            )}

            {summary.tripCount > 0 && (
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                <YourBalances summary={summary} />
                <RecentSettlements />
              </div>
            )}
          </>
        )}
        {loading && summary && (
          <span className="sr-only" role="status">
            Refreshing…
          </span>
        )}
      </div>
    </>
  )
}
