import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltipBox } from '@/components/charts/ChartTooltip'
import { formatCompact, niceScale } from '@/components/charts/chartTheme'
import { useChartColors } from '@/components/charts/useChartColors'
import { TableView } from '@/components/charts/TableView'
import type { TripMoney } from '@/hooks/useDisplayCurrency'
import { getCurrency } from '@/lib/currencies'
import { toMajor } from '@/utils/calculations/money'

export interface MonthSpend {
  /** 'yyyy-MM' */
  month: string
  /** "Oct" */
  shortName: string
  /** "October 2026" */
  label: string
  /** Trip-currency minor units */
  spent: number
}

interface Point extends MonthSpend {
  /** Display-currency major units — plotted */
  value: number
}

interface MonthlyTrendProps {
  months: MonthSpend[]
  /** Per-month budget, trip-currency minor units (0 = none) */
  budgetMinor: number
  money: TripMoney
}

/** Spending per month with the monthly budget as a reference line. */
export function MonthlyTrend({ months, budgetMinor, money }: MonthlyTrendProps) {
  const colors = useChartColors()
  const symbol = getCurrency(money.currency).symbol.trim()
  const plot = (minor: number) => toMajor(money.convert(minor), money.currency)
  const points: Point[] = months.map((month) => ({ ...month, value: plot(month.spent) }))
  const budgetValue = plot(budgetMinor)
  const scale = niceScale(Math.max(0, ...points.map((point) => point.value), budgetMinor > 0 ? budgetValue : 0))

  const versusBudget = (spent: number) => {
    if (budgetMinor <= 0) return '—'
    const difference = budgetMinor - spent
    return difference >= 0 ? `${money.format(difference)} under` : `${money.format(-difference)} over`
  }

  return (
    <div>
      <div
        className="h-56"
        role="img"
        aria-label={`Spending in each of the last ${months.length} months${budgetMinor > 0 ? ', against the monthly budget' : ''}. A table view follows.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="shortName" tick={colors.axisTick} tickLine={false} axisLine={{ stroke: colors.baseline }} />
            <YAxis
              tick={colors.axisTick}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) => formatCompact(value, symbol)}
              domain={[0, scale.max]}
              ticks={scale.ticks}
            />
            <Tooltip
              cursor={{ fill: colors.grid, opacity: 0.5 }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined
                if (!point) return null
                return (
                  <ChartTooltipBox
                    title={point.label}
                    rows={[
                      {
                        key: 'spent',
                        color: colors.series[0],
                        value: money.format(point.spent),
                        label: budgetMinor > 0 ? versusBudget(point.spent) : 'spent',
                      },
                    ]}
                  />
                )
              }}
            />
            {budgetMinor > 0 && (
              <ReferenceLine
                y={budgetValue}
                stroke={colors.inkSecondary}
                strokeWidth={1}
                label={{ value: `Budget ${money.format(budgetMinor)}`, position: 'insideTopRight', fill: colors.inkSecondary, fontSize: 12 }}
              />
            )}
            <Bar dataKey="value" fill={colors.series[0]} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView
        caption="Spending by month"
        columns={['Month', 'Spent', 'Against budget']}
        rows={[...months].reverse().map((month) => ({
          key: month.month,
          cells: [month.label, money.format(month.spent), versusBudget(month.spent)],
        }))}
      />
    </div>
  )
}
