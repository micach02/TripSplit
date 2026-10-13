import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltipBox } from '@/components/charts/ChartTooltip'
import { formatCompact, niceScale } from '@/components/charts/chartTheme'
import { useChartColors } from '@/components/charts/useChartColors'
import { TableView } from '@/components/charts/TableView'
import type { TripMoney } from '@/hooks/useDisplayCurrency'
import { getCurrency } from '@/lib/currencies'
import { toMajor } from '@/utils/calculations/money'

export interface PersonSpendRow {
  userId: string
  name: string
  /** Trip-currency minor units */
  paid: number
  share: number
}

interface Datum {
  name: string
  paid: number
  share: number
  paidMinor: number
  shareMinor: number
}

const SERIES_KEYS = [
  { key: 'paid', label: 'Paid', hint: 'what they covered', slot: 0 },
  { key: 'share', label: 'Share', hint: 'what they used', slot: 1 },
] as const

/** Paid vs share for each traveler — horizontal grouped bars, one axis. */
export function PersonSpendingBars({ rows, money }: { rows: PersonSpendRow[]; money: TripMoney }) {
  const colors = useChartColors()
  const symbol = getCurrency(money.currency).symbol.trim()
  const plot = (minor: number) => toMajor(money.convert(minor), money.currency)
  const data: Datum[] = rows.map((row) => ({
    name: row.name,
    paid: plot(row.paid),
    share: plot(row.share),
    paidMinor: row.paid,
    shareMinor: row.share,
  }))
  const scale = niceScale(Math.max(0, ...data.flatMap((datum) => [datum.paid, datum.share])))

  return (
    <div>
      {/* Two series → a legend is always present */}
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legend">
        {SERIES_KEYS.map((series) => (
          <li key={series.key} className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: colors.series[series.slot] }} />
            <span className="font-semibold text-slate-800">{series.label}</span>
            <span className="text-slate-500">{series.hint}</span>
          </li>
        ))}
      </ul>
      <div style={{ height: rows.length * 56 + 32 }} role="img" aria-label="What each traveler paid compared with their share. A table view follows.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barGap={2} barCategoryGap={14}>
            <CartesianGrid horizontal={false} stroke={colors.grid} />
            <XAxis
              type="number"
              tick={colors.axisTick}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatCompact(value, symbol)}
              domain={[0, scale.max]}
              ticks={scale.ticks}
            />
            <YAxis type="category" dataKey="name" width={76} tick={colors.axisTick} tickLine={false} axisLine={{ stroke: colors.baseline }} />
            <Tooltip
              cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
              content={({ active, payload }) => {
                const datum = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
                if (!datum) return null
                return (
                  <ChartTooltipBox
                    title={datum.name}
                    rows={[
                      { key: 'paid', color: colors.series[0], value: money.format(datum.paidMinor), label: 'paid' },
                      { key: 'share', color: colors.series[1], value: money.format(datum.shareMinor), label: 'share' },
                    ]}
                  />
                )
              }}
            />
            {/* ≤ 24px per group; 4px rounded data-end, square at the baseline */}
            <Bar dataKey="paid" name="Paid" fill={colors.series[0]} barSize={11} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            <Bar dataKey="share" name="Share" fill={colors.series[1]} barSize={11} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView
        caption="Paid and share by traveler"
        columns={['Traveler', 'Paid', 'Share']}
        rows={rows.map((row) => ({ key: row.userId, cells: [row.name, money.format(row.paid), money.format(row.share)] }))}
      />
    </div>
  )
}
