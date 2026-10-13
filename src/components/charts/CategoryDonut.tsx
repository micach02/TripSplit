import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartTooltipBox } from '@/components/charts/ChartTooltip'
import type { ChartColors } from '@/components/charts/chartTheme'
import { useChartColors } from '@/components/charts/useChartColors'
import { TableView } from '@/components/charts/TableView'
import type { CategorySpend } from '@/utils/calculations/analytics'

const MAX_SLICES = 5

interface Slice {
  key: string
  label: string
  icon: string
  /** Trip-currency minor units */
  amount: number
  percent: number
  color: string
}

/** Top five categories + "Other", so the donut never exceeds six segments. */
function toSlices(categories: CategorySpend[], colors: ChartColors): Slice[] {
  const top = categories.slice(0, MAX_SLICES).map((category, index) => ({
    key: category.id,
    label: category.name,
    icon: category.icon,
    amount: category.amount,
    percent: category.percent,
    color: colors.series[index],
  }))
  const rest = categories.slice(MAX_SLICES)
  if (rest.length === 0) return top
  const amount = rest.reduce((sum, category) => sum + category.amount, 0)
  const percent = Math.round(rest.reduce((sum, category) => sum + category.percent, 0) * 10) / 10
  return [...top, { key: 'other', label: `Other (${rest.length})`, icon: '•', amount, percent, color: colors.neutral }]
}

interface CategoryDonutProps {
  categories: CategorySpend[]
  /** Formats trip-currency minor units in the display currency */
  format: (minor: number) => string
}

export function CategoryDonut({ categories, format }: CategoryDonutProps) {
  const colors = useChartColors()
  const slices = toSlices(categories, colors)
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0)

  return (
    // Donut above, legend below at full width — names never truncate, even in a half-width card.
    <div className="grid grid-cols-1 gap-6">
      <div className="relative mx-auto aspect-square w-full max-w-48" role="img" aria-label="Spending by category, as a donut chart. The list below has every value.">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                // 2px surface gap between segments — no outlines
                <Cell key={slice.key} fill={slice.color} stroke={colors.surface} strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const slice = active ? (payload?.[0]?.payload as Slice | undefined) : undefined
                if (!slice) return null
                return (
                  <ChartTooltipBox
                    rows={[{ key: slice.key, color: slice.color, value: format(slice.amount), label: `${slice.label} · ${slice.percent}%` }]}
                  />
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500">Total</span>
          <span className="text-lg font-extrabold text-slate-900">{format(total)}</span>
        </div>
      </div>

      {/* The legend doubles as the table view: every value is readable without hovering. */}
      <ul className="space-y-2" aria-label="Spending by category">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-3 text-sm">
            <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
            <span aria-hidden className="w-5 text-center">
              {slice.icon}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{slice.label}</span>
            <span className="font-bold text-slate-900 tabular-nums">{format(slice.amount)}</span>
            <span className="w-14 text-right text-slate-500 tabular-nums">{slice.percent}%</span>
          </li>
        ))}
      </ul>

      {/* "Other" hides the smaller categories; the table lists every one. */}
      {categories.length > MAX_SLICES && (
        <div className="-mt-3">
          <TableView
            label={`See all ${categories.length} categories`}
            caption="Spending by category, every category"
            columns={['Category', 'Spent', 'Share']}
            rows={categories.map((category) => ({
              key: category.id,
              cells: [
                <span key="name" className="flex items-center gap-2">
                  <span aria-hidden>{category.icon}</span>
                  {category.name}
                </span>,
                format(category.amount),
                `${category.percent}%`,
              ],
            }))}
          />
        </div>
      )}
    </div>
  )
}
