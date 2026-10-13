import { useState } from 'react'
import { format as formatDate, parseISO } from 'date-fns'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltipBox } from '@/components/charts/ChartTooltip'
import { formatCompact, niceScale } from '@/components/charts/chartTheme'
import { useChartColors } from '@/components/charts/useChartColors'
import { TableView } from '@/components/charts/TableView'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { TripMoney } from '@/hooks/useDisplayCurrency'
import { getCurrency } from '@/lib/currencies'
import type { DailySpend } from '@/utils/calculations/analytics'
import { toMajor } from '@/utils/calculations/money'

type Mode = 'daily' | 'cumulative'
const MODES = [
  { value: 'daily' as const, label: 'Per day' },
  { value: 'cumulative' as const, label: 'Running total' },
]

interface Point {
  date: string
  label: string
  /** Trip-currency minor units — formatted for tooltips/tables */
  minor: number
  /** Display-currency major units — plotted */
  value: number
}

interface SpendingOverTimeProps {
  days: DailySpend[]
  budgetMinor: number
  money: TripMoney
  /** "across the trip", "in October 2026" */
  periodLabel?: string
}

export function SpendingOverTime({ days, budgetMinor, money, periodLabel = 'across the trip' }: SpendingOverTimeProps) {
  const [mode, setMode] = useState<Mode>('daily')
  const colors = useChartColors()
  const symbol = getCurrency(money.currency).symbol.trim()
  const plot = (minor: number) => toMajor(money.convert(minor), money.currency)

  const points: Point[] = days.map((day) => {
    const minor = mode === 'daily' ? day.amount : day.cumulative
    return { date: day.date, label: formatDate(parseISO(day.date), 'MMM d'), minor, value: plot(minor) }
  })
  const showBudget = mode === 'cumulative' && budgetMinor > 0
  const budgetValue = plot(budgetMinor)
  const scale = niceScale(Math.max(0, ...points.map((point) => point.value), showBudget ? budgetValue : 0))

  return (
    <div>
      <SegmentedControl label="Show spending" value={mode} options={MODES} onChange={setMode} className="mb-4 max-w-xs" />
      <div className="h-60" role="img" aria-label={`Spending ${mode === 'daily' ? 'per day' : 'running total'} ${periodLabel}. A table view follows.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis
              dataKey="label"
              tick={colors.axisTick}
              tickLine={false}
              axisLine={{ stroke: colors.baseline }}
              minTickGap={24}
            />
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
              cursor={{ stroke: colors.baseline, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined
                if (!point) return null
                return (
                  <ChartTooltipBox
                    title={formatDate(parseISO(point.date), 'EEE, MMM d')}
                    rows={[
                      {
                        key: 'spend',
                        color: colors.series[0],
                        value: money.format(point.minor),
                        label: mode === 'daily' ? 'spent' : 'spent so far',
                      },
                    ]}
                  />
                )
              }}
            />
            {showBudget && (
              <ReferenceLine
                y={budgetValue}
                stroke={colors.inkSecondary}
                strokeWidth={1}
                label={{ value: `Budget ${money.format(budgetMinor)}`, position: 'insideTopRight', fill: colors.inkSecondary, fontSize: 12 }}
              />
            )}
            <Area
              type="linear"
              dataKey="value"
              stroke={colors.series[0]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill={colors.series[0]}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 5, fill: colors.series[0], stroke: colors.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <TableView
        caption="Spending by day"
        columns={['Date', 'Spent', 'Running total']}
        rows={days.map((day) => ({
          key: day.date,
          cells: [formatDate(parseISO(day.date), 'EEE, MMM d'), money.format(day.amount), money.format(day.cumulative)],
        }))}
      />
    </div>
  )
}
