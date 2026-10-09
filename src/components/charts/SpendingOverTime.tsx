import { useState } from 'react'
import { format as formatDate, parseISO } from 'date-fns'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltipBox } from '@/components/charts/ChartTooltip'
import { AXIS_TICK, BASELINE, formatCompact, GRID, INK_SECONDARY, niceScale, SERIES, SURFACE } from '@/components/charts/chartTheme'
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
}

export function SpendingOverTime({ days, budgetMinor, money }: SpendingOverTimeProps) {
  const [mode, setMode] = useState<Mode>('daily')
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
      <div className="h-60" role="img" aria-label={`Spending ${mode === 'daily' ? 'per day' : 'running total'} across the trip. A table view follows.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: BASELINE }}
              minTickGap={24}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) => formatCompact(value, symbol)}
              domain={[0, scale.max]}
              ticks={scale.ticks}
            />
            <Tooltip
              cursor={{ stroke: BASELINE, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined
                if (!point) return null
                return (
                  <ChartTooltipBox
                    title={formatDate(parseISO(point.date), 'EEE, MMM d')}
                    rows={[
                      {
                        key: 'spend',
                        color: SERIES[0],
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
                stroke={INK_SECONDARY}
                strokeWidth={1}
                label={{ value: `Budget ${money.format(budgetMinor)}`, position: 'insideTopRight', fill: INK_SECONDARY, fontSize: 12 }}
              />
            )}
            <Area
              type="linear"
              dataKey="value"
              stroke={SERIES[0]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill={SERIES[0]}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 5, fill: SERIES[0], stroke: SURFACE, strokeWidth: 2 }}
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
