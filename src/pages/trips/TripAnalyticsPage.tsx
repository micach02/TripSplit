import { useMemo } from 'react'
import { Link } from 'react-router'
import { CalendarDays, ChartPie, ReceiptText, Trophy, Users } from 'lucide-react'
import { CategoryBudgetMeters } from '@/components/charts/CategoryBudgetMeters'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { MonthlyTrend } from '@/components/charts/MonthlyTrend'
import { PersonSpendingBars } from '@/components/charts/PersonSpendingBars'
import { SpendingOverTime } from '@/components/charts/SpendingOverTime'
import { StatCard } from '@/components/dashboard/StatCard'
import { Alert } from '@/components/ui/Alert'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { memberName, useTripContext } from '@/hooks/useTripContext'
import { useTripLedger } from '@/hooks/useTripLedger'
import { getErrorMessage } from '@/lib/errors'
import { tripPath } from '@/routes/paths'
import { compareCategoryBudgets, spendingByCategory, spendingByDay } from '@/utils/calculations/analytics'
import { calculateBalances } from '@/utils/calculations/balanceCalculator'
import { budgetTone, getBudgetUsage } from '@/utils/calculations/budgetCalculator'
import { firstName } from '@/utils/format'
import { elapsedDays, monthPeriod, recentMonths, shiftMonth } from '@/utils/budgetPeriod'
import { categoryChanges } from '@/utils/calculations/insights'
import { todayIso, tripLengthInDays } from '@/utils/tripStatus'

export default function TripAnalyticsPage() {
  const context = useTripContext()
  const { trip, members, categories, money, isOwner, isBudget, copy, period, monthRange, months } = context
  // Budgets: what's available this month (with any rollover). Trips: the trip budget.
  const budgetMinor = context.availableMinor
  const ledger = useTripLedger(trip)

  const analytics = useMemo(() => {
    if (!ledger.data) return null
    const allExpenses = ledger.data.expenses
    // Budgets: only the month being viewed. Trips: everything.
    const expenses = period
      ? ledger.data.expenses.filter((expense) => expense.date >= period.start && expense.date <= period.end)
      : ledger.data.expenses
    const items = expenses.map((expense) => ({ categoryId: expense.categoryId, date: expense.date, total: expense.total }))
    const total = items.reduce((sum, item) => sum + item.total, 0)
    const balances = calculateBalances(members.map((m) => m.userId), expenses)
    const byUser = new Map(balances.map((balance) => [balance.userId, balance]))

    // Average over the days so far (the whole trip or month once it's over)
    const today = todayIso()
    let daysSoFar = 1
    let chartStart = trip.start_date
    let chartEnd = trip.end_date ?? today
    if (period) {
      daysSoFar = elapsedDays(period, today)
      chartStart = period.start
      // The current month is drawn up to today, not across empty days ahead.
      chartEnd = today < period.end ? today : period.end
    } else if (trip.end_date) {
      const lastDay = today < trip.end_date ? today : trip.end_date
      daysSoFar = today < trip.start_date ? 1 : Math.max(1, tripLengthInDays(trip.start_date, lastDay))
    }

    return {
      total,
      count: items.length,
      perDay: Math.round(total / daysSoFar),
      perPerson: members.length ? Math.round(total / members.length) : 0,
      byCategory: spendingByCategory(items, categories),
      days: spendingByDay(items, chartStart, chartEnd < chartStart ? chartStart : chartEnd),
      people: members.map((member) => ({
        userId: member.userId,
        name: firstName(memberName(context, member.userId, { you: true })),
        paid: byUser.get(member.userId)?.paid ?? 0,
        share: byUser.get(member.userId)?.share ?? 0,
      })),
      // Budgets: each category against the month before
      changes: period
        ? (() => {
            const previous = monthPeriod(shiftMonth(period.month, -1))
            const totals = (from: string, to: string) => {
              const byCategory = new Map<string, number>()
              for (const expense of allExpenses) {
                if (expense.date >= from && expense.date <= to) {
                  byCategory.set(expense.categoryId, (byCategory.get(expense.categoryId) ?? 0) + expense.total)
                }
              }
              return categories
                .filter((category) => byCategory.has(category.id))
                .map((category) => ({ key: category.id, name: category.name, icon: category.icon, color: category.color, amount: byCategory.get(category.id) ?? 0 }))
            }
            return categoryChanges(totals(period.start, period.end), totals(previous.start, previous.end)).slice(0, 5)
          })()
        : [],
      budgets: compareCategoryBudgets(
        ledger.data.budgets.map((budget) => ({ categoryId: budget.categoryId, planned: budget.planned })),
        items,
        categories,
      ),
    }
  }, [ledger.data, members, categories, trip.start_date, trip.end_date, period, context])

  // Budgets: the last six months up to the one being viewed
  const trend = useMemo(() => {
    if (!period || !monthRange) return null
    const spentByMonth = new Map(months.map((row) => [row.month, row.spentMinor]))
    return recentMonths(period.month, 6, monthRange.earliest).map((month) => {
      const info = monthPeriod(month)
      return { month, shortName: info.shortName, label: info.label, spent: spentByMonth.get(month) ?? 0 }
    })
  }, [period, monthRange, months])

  if (ledger.error && !ledger.data) {
    return <Alert tone="error" title="We couldn't load analytics">{getErrorMessage(ledger.error)}</Alert>
  }
  if (!analytics) return <PageSkeleton heading={false} label="Crunching the numbers…" />

  if (analytics.count === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <EmptyState
            icon={ChartPie}
            title={period ? `No spending in ${period.label}` : 'No spending to analyze yet'}
            description={period ? 'Pick another month above, or add expenses for this one.' : 'Charts appear here once expenses are added.'}
          />
        </Card>
        {trend && trend.some((month) => month.spent > 0) && (
          <Card>
            <CardHeader title="Month by month" />
            <CardBody>
              <MonthlyTrend months={trend} budgetMinor={budgetMinor} money={money} />
            </CardBody>
          </Card>
        )}
      </div>
    )
  }

  const top = analytics.byCategory[0]
  const usage = getBudgetUsage(analytics.total, budgetMinor)

  return (
    <div className="space-y-6">
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total spent" value={money.format(analytics.total)} icon={ReceiptText} tone="primary" hint={`${analytics.count} expenses`} />
        <StatCard label="Per day" value={money.format(analytics.perDay)} icon={CalendarDays} hint="average so far" />
        <StatCard
          label="Per person"
          value={money.format(analytics.perPerson)}
          icon={Users}
          hint={`across ${members.length} ${members.length === 1 ? copy.member : copy.members}`}
        />
        <StatCard
          label="Top category"
          value={top ? `${top.icon} ${top.name}` : '—'}
          icon={Trophy}
          hint={top ? `${money.format(top.amount)} · ${top.percent}%` : undefined}
        />
      </section>

      <Card>
        <CardHeader title="Budget usage" />
        <CardBody className="space-y-6">
          {/* One compact meter — the full Budget · Spent · Remaining summary is already in the header */}
          {usage.percentUsed === null ? (
            <p className="text-sm text-slate-500">No {isBudget ? 'monthly' : 'trip'} budget set.</p>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-800">{isBudget ? `${period?.name} budget` : 'Trip budget'}</span>
                <span className="text-slate-600">
                  <span className="font-bold text-slate-900">{money.format(analytics.total)}</span> of {money.format(budgetMinor)}
                </span>
              </div>
              <ProgressBar value={usage.percentUsed} tone={budgetTone(usage)} label={`${usage.percentUsed}% of the ${isBudget ? 'monthly' : 'trip'} budget used`} />
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {usage.overBy > 0
                  ? `${money.format(usage.overBy)} over budget`
                  : `${usage.percentUsed}% used · ${money.format(usage.remaining)} left`}
              </p>
            </div>
          )}
          {analytics.budgets.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-900">By category</h3>
              <CategoryBudgetMeters rows={analytics.budgets} money={money} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {isOwner ? (
                <>
                  {isBudget ? 'Set monthly limits for groceries, dining out and more in' : 'Plan how much to spend on food, hotels and activities in'}{' '}
                  <Link to={tripPath(trip.id, 'settings')} className="font-semibold text-blue-600 hover:text-blue-700">
                    Settings → Category budgets
                  </Link>{' '}
                  to compare plan vs actual here.
                </>
              ) : (
                `The ${copy.noun} owner can set category budgets to compare plan vs actual.`
              )}
            </p>
          )}
        </CardBody>
      </Card>

      {period && analytics.changes.length > 0 && (
        <Card>
          <CardHeader title={`Compared with ${monthPeriod(shiftMonth(period.month, -1)).name}`} />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {analytics.changes.map((change) => (
                <li key={change.key} className="flex items-center gap-3 py-2.5 text-sm">
                  <span aria-hidden className="w-5 text-center">
                    {change.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{change.name}</span>
                  <span className="text-slate-500 tabular-nums">{money.format(change.current)}</span>
                  <span
                    className={
                      change.delta > 0
                        ? 'w-28 text-right font-semibold text-orange-700 tabular-nums'
                        : 'w-28 text-right font-semibold text-emerald-700 tabular-nums'
                    }
                  >
                    {change.delta > 0 ? '▲' : '▼'} {money.format(Math.abs(change.delta))}
                    {change.percent !== null && <span className="sr-only"> ({change.percent}%)</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">▲ spent more than last month · ▼ spent less</p>
          </CardBody>
        </Card>
      )}

      {trend && trend.length > 1 && (
        <Card>
          <CardHeader title="Month by month" description="How each month compares with the monthly budget." />
          <CardBody>
            <MonthlyTrend months={trend} budgetMinor={budgetMinor} money={money} />
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Spending by category" />
          <CardBody>
            <CategoryDonut categories={analytics.byCategory} format={(minor) => money.format(minor)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Spending over time" />
          <CardBody>
            <SpendingOverTime
              days={analytics.days}
              budgetMinor={budgetMinor}
              money={money}
              periodLabel={period ? `in ${period.label}` : 'across the trip'}
            />
          </CardBody>
        </Card>
      </div>

      {members.length > 1 && (
        <Card>
          <CardHeader
            title="Spending by person"
            description={`What each ${copy.member} paid for, compared with their share of the expenses.`}
          />
          <CardBody>
            <PersonSpendingBars rows={analytics.people} money={money} />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
