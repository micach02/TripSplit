import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { Download, PiggyBank, Plus, ReceiptText, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { MonthlyTrend } from '@/components/charts/MonthlyTrend'
import { SpendingCalendar } from '@/components/charts/SpendingCalendar'
import { IncomeDialog } from '@/components/spending/IncomeDialog'
import { CurrencyViewPicker } from '@/components/trips/DisplayCurrencyPicker'
import { MonthSwitcher } from '@/components/trips/MonthSwitcher'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { makeTripMoney } from '@/hooks/useDisplayCurrency'
import { useAsync } from '@/hooks/useAsync'
import { useCurrentUser } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useViewCurrency } from '@/hooks/useViewCurrency'
import { cn } from '@/lib/cn'
import { useDataChanged } from '@/lib/dataEvents'
import { getErrorMessage } from '@/lib/errors'
import { newBudgetPath, tripPath } from '@/routes/paths'
import { getMySpending } from '@/services/mySpendingService'
import type { Income } from '@/types/models'
import { currentMonth, monthPeriod, shiftMonth } from '@/utils/budgetPeriod'
import { formatMoney, toDecimalString, toMinor } from '@/utils/calculations/money'
import { downloadCsv, slugify, toCsv } from '@/utils/csv'
import { formatDate } from '@/utils/format'
import { paymentMethodLabel } from '@/utils/paymentMethods'
import { todayIso } from '@/utils/tripStatus'

/** "My spending": your share of every budget and trip, month by month. */
export default function MySpendingPage() {
  const { user } = useCurrentUser()
  const toast = useToast()
  const { currency, preferred, setCurrency } = useViewCurrency()
  const latest = currentMonth()
  const [month, setMonth] = useState(latest)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [incomeDialog, setIncomeDialog] = useState<Income | 'new' | null>(null)
  const load = useCallback(() => getMySpending(month, currency, user.id), [month, currency, user.id])
  const { data, error, loading, reload } = useAsync(load)
  useDataChanged(reload)

  const format = (minor: number) => formatMoney(minor, currency)
  // The charts take a "money" helper; everything here is already in `currency`.
  const money = makeTripMoney(currency, currency, null, false)
  const period = monthPeriod(month)
  const summary = data?.summary

  function changeMonth(next: string) {
    setMonth(next)
    setSelectedDay(null)
  }

  function exportCsv() {
    if (!summary) return
    const rows = [
      ['Date', 'Description', 'Category', 'Budget or trip', 'Paid with', 'Paid by', `Your share (${currency})`, 'Your share', 'Currency'],
      ...[...summary.rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((row) => [
          row.date,
          row.description,
          row.categoryName,
          row.tripName,
          row.paidBy === user.id ? paymentMethodLabel(row.paymentMethod) : '',
          row.paidBy === user.id ? 'You' : 'Someone else',
          toDecimalString(row.share, currency),
          toDecimalString(row.myShare, row.tripCurrency),
          row.tripCurrency,
        ]),
    ]
    downloadCsv(`my-spending-${slugify(period.label)}.csv`, toCsv(rows))
  }

  const picker = (
    <CurrencyViewPicker value={currency} onChange={setCurrency} homeCurrency={preferred} homeLabel="yours" loading={loading && Boolean(data)} />
  )

  return (
    <>
      <PageTitle title={`My spending · ${period.shortLabel}`} />
      <PageHeader
        title="My spending"
        description="Your share of everything, across all your budgets and trips."
        actions={
          summary &&
          summary.rows.length > 0 && (
            <Button variant="outline" onClick={exportCsv} icon={<Download className="size-4" aria-hidden />}>
              Export CSV
            </Button>
          )
        }
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MonthSwitcher period={period} range={{ earliest: shiftMonth(latest, -24), latest }} onChange={changeMonth} className="-ml-2" />
          {picker}
        </div>

        {error && !data ? (
          <Alert tone="error" title="We couldn't load your spending">
            <p>{getErrorMessage(error)}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              Try again
            </Button>
          </Alert>
        ) : !summary ? (
          <PageSkeleton heading={false} label="Adding up your spending…" />
        ) : (
          <>
            {/* The headline */}
            <section aria-label="Total" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Card className="p-5 sm:p-6">
                <p className="text-sm font-semibold text-slate-500">You spent in {period.label}</p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">{format(summary.total)}</p>
                {summary.changePercent !== null && (
                  <p
                    className={cn(
                      'mt-2 flex items-center gap-1.5 text-sm font-semibold',
                      summary.changePercent > 0 ? 'text-orange-700' : 'text-emerald-700',
                    )}
                  >
                    {summary.changePercent > 0 ? (
                      <TrendingUp className="size-4" aria-hidden />
                    ) : (
                      <TrendingDown className="size-4" aria-hidden />
                    )}
                    {summary.changePercent > 0 ? '+' : ''}
                    {summary.changePercent}% vs {monthPeriod(shiftMonth(month, -1)).name} ({format(summary.previousTotal)})
                  </p>
                )}
                {summary.forecast && summary.total > 0 && (
                  <p className="mt-1 text-sm text-slate-600">
                    At this pace: <span className="font-semibold">{format(summary.forecast.projectedMinor)}</span> by{' '}
                    {formatDate(period.end)}
                    {summary.forecast.early && <span className="text-slate-500"> (early estimate)</span>}
                  </p>
                )}
                {summary.missingCurrencies.length > 0 && (
                  <p className="mt-2 text-xs text-orange-700">
                    Not included: amounts in {summary.missingCurrencies.join(', ')} (exchange rates unavailable).
                  </p>
                )}
              </Card>

              {/* Income & savings */}
              <Card className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <PiggyBank className="size-4" aria-hidden />
                    Income & savings
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => setIncomeDialog('new')} icon={<Plus className="size-4" aria-hidden />}>
                    Income
                  </Button>
                </div>
                {summary.income > 0 && summary.saved !== null ? (
                  <>
                    <dl className="mt-3 grid grid-cols-3 gap-2">
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Income</dt>
                        <dd className="truncate font-extrabold text-slate-900 tabular-nums">{format(summary.income)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Spent</dt>
                        <dd className="truncate font-extrabold text-slate-900 tabular-nums">{format(summary.total)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">{summary.saved >= 0 ? 'Saved' : 'Overspent'}</dt>
                        <dd
                          className={cn(
                            'truncate font-extrabold tabular-nums',
                            summary.saved >= 0 ? 'text-emerald-700' : 'text-red-600',
                          )}
                        >
                          {format(Math.abs(summary.saved))}
                        </dd>
                      </div>
                    </dl>
                    {summary.savingsRate !== null && summary.saved >= 0 && (
                      <div className="mt-3">
                        <ProgressBar value={Math.min(100, summary.savingsRate)} label={`Saved ${summary.savingsRate}% of income`} />
                        <p className="mt-1 text-xs font-semibold text-slate-500">You saved {summary.savingsRate}% of your income.</p>
                      </div>
                    )}
                    <ul className="mt-3 space-y-1 text-sm">
                      {data.incomes.map((income) => (
                        <li key={income.id}>
                          <button
                            type="button"
                            onClick={() => setIncomeDialog(income)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left hover:bg-slate-50"
                          >
                            <span className="truncate text-slate-700">
                              {income.source} · <span className="text-slate-500">{formatDate(income.received_on)}</span>
                            </span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {formatMoney(toMinor(income.amount, income.currency), income.currency)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Add what you earned this month to see what you saved. Income is private — only you can see it.
                  </p>
                )}
              </Card>
            </section>

            {summary.total === 0 ? (
              <Card>
                <EmptyState
                  icon={Wallet}
                  title={`Nothing spent in ${period.label}`}
                  description="Expenses you add to any budget or trip — or share with others — show up here."
                  action={
                    <Link to={newBudgetPath} className="font-semibold text-blue-600 hover:text-blue-700">
                      Start a monthly budget
                    </Link>
                  }
                />
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader title="By category" />
                    <CardBody>
                      <CategoryDonut
                        categories={summary.byCategory.map(({ key, ...category }) => ({ ...category, id: key }))}
                        format={format}
                      />
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title="Spending calendar" description="Tap a day to see what you spent." />
                    <CardBody>
                      <SpendingCalendar
                        days={summary.byDay}
                        format={format}
                        selected={selectedDay}
                        onSelect={setSelectedDay}
                        today={todayIso()}
                      />
                    </CardBody>
                  </Card>
                </div>

                {summary.categoryChanges.length > 0 && (
                  <Card>
                    <CardHeader title={`Compared with ${monthPeriod(shiftMonth(month, -1)).name}`} />
                    <CardBody>
                      <ul className="divide-y divide-slate-100">
                        {summary.categoryChanges.slice(0, 6).map((change) => (
                          <li key={change.key} className="flex items-center gap-3 py-2.5 text-sm">
                            <span aria-hidden className="w-5 text-center">
                              {change.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{change.name}</span>
                            <span className="text-slate-500 tabular-nums">{format(change.current)}</span>
                            <span
                              className={cn(
                                'w-28 text-right font-semibold tabular-nums',
                                change.delta > 0 ? 'text-orange-700' : 'text-emerald-700',
                              )}
                            >
                              {change.delta > 0 ? '▲' : '▼'} {format(Math.abs(change.delta))}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-slate-500">▲ spent more than last month · ▼ spent less</p>
                    </CardBody>
                  </Card>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader title="By budget or trip" />
                    <CardBody>
                      <ul className="space-y-3">
                        {summary.byTrip.map((trip) => (
                          <li key={trip.tripId}>
                            <Link to={tripPath(trip.tripId)} className="block rounded-lg">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate font-semibold text-slate-800">{trip.tripName}</span>
                                <span className="font-bold text-slate-900 tabular-nums">{format(trip.amount)}</span>
                              </div>
                              <ProgressBar
                                value={summary.total ? (trip.amount * 100) / summary.total : 0}
                                label={`${trip.tripName}: ${Math.round(summary.total ? (trip.amount * 100) / summary.total : 0)}% of your spending`}
                                className="mt-1.5"
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title="What you paid with" description="Expenses you paid for, at their full amount." />
                    <CardBody>
                      {summary.byPaymentMethod.length === 0 ? (
                        <p className="text-sm text-slate-500">Others paid for everything you shared this month.</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {summary.byPaymentMethod.map((entry) => (
                            <li key={entry.method ?? 'none'} className="flex items-center justify-between py-2.5 text-sm">
                              <span className="font-semibold text-slate-800">{paymentMethodLabel(entry.method)}</span>
                              <span className="font-bold text-slate-900 tabular-nums">{format(entry.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardBody>
                  </Card>
                </div>

                <Card>
                  <CardHeader title="Month by month" />
                  <CardBody>
                    <MonthlyTrend
                      months={summary.months.map((m) => ({ month: m.month, shortName: monthPeriod(m.month).shortName, label: monthPeriod(m.month).label, spent: m.amount }))}
                      budgetMinor={0}
                      money={money}
                    />
                  </CardBody>
                </Card>
              </>
            )}

            {summary.rows.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader
                  title={selectedDay ? formatDate(selectedDay) : `Your expenses in ${period.name}`}
                  action={
                    selectedDay && (
                      <button type="button" onClick={() => setSelectedDay(null)} className="tap-target text-sm font-semibold text-blue-600">
                        Show all
                      </button>
                    )
                  }
                />
                <ul className="mt-3 divide-y divide-slate-100">
                  {summary.rows
                    .filter((row) => !selectedDay || row.date === selectedDay)
                    .slice(0, selectedDay ? undefined : 30)
                    .map((row) => (
                      <li key={row.expenseId}>
                        <Link
                          to={`${tripPath(row.tripId, 'expenses')}?month=${month}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 sm:px-6"
                        >
                          <span
                            aria-hidden
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-lg"
                            style={{ backgroundColor: `${row.categoryColor}1f` }}
                          >
                            {row.categoryIcon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">{row.description}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {row.tripName} · {formatDate(row.date)}
                            </span>
                          </span>
                          <span className="text-sm font-bold text-slate-900 tabular-nums">{format(row.share)}</span>
                        </Link>
                      </li>
                    ))}
                  {selectedDay && summary.rows.every((row) => row.date !== selectedDay) && (
                    <li className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500 sm:px-6">
                      <ReceiptText className="size-4" aria-hidden /> Nothing spent that day.
                    </li>
                  )}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>

      <IncomeDialog
        open={incomeDialog !== null}
        existing={incomeDialog === 'new' ? null : incomeDialog}
        defaultCurrency={currency}
        onClose={() => setIncomeDialog(null)}
        onSaved={(message) => {
          toast.success(message)
          setIncomeDialog(null)
          reload()
        }}
      />
    </>
  )
}
