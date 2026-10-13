import { format, getDay, parseISO } from 'date-fns'
import { TableView } from '@/components/charts/TableView'
import { cn } from '@/lib/cn'

interface SpendingCalendarProps {
  /** Every day of the month, in order */
  days: ReadonlyArray<{ date: string; amount: number }>
  format: (minor: number) => string
  selected: string | null
  onSelect: (date: string | null) => void
  today: string
}

// One hue, stepping away from the page as spending grows (sequential); empty days stay neutral.
// The busiest steps knock their text out in the surface colour, so it reads in both modes.
const LEVELS = ['bg-slate-100 text-slate-600', 'bg-blue-100 text-blue-900', 'bg-blue-300 text-blue-950', 'bg-blue-600 text-surface', 'bg-blue-800 text-surface']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Thresholds from the spending days themselves, so one big day doesn't wash out the rest. */
function levelFor(amount: number, cuts: number[]): number {
  if (amount <= 0) return 0
  return 1 + cuts.filter((cut) => amount > cut).length
}

function quantileCuts(amounts: number[]): number[] {
  const sorted = amounts.filter((a) => a > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return [at(0.25), at(0.5), at(0.75)]
}

/** A month as a heat map: darker days are bigger spending days. Tap a day to see it. */
export function SpendingCalendar({ days, format: formatAmount, selected, onSelect, today }: SpendingCalendarProps) {
  const cuts = quantileCuts(days.map((day) => day.amount))
  // Monday-first: blanks before the 1st
  const lead = days.length ? (getDay(parseISO(days[0].date)) + 6) % 7 : 0

  return (
    <div>
      {/* Toggle buttons rather than an ARIA grid: each one's label already names its weekday. */}
      <div className="grid grid-cols-7 gap-1.5 text-center" role="group" aria-label="Spending by day">
        {WEEKDAYS.map((day) => (
          <div key={day} aria-hidden className="pb-1 text-[11px] font-semibold text-slate-500">
            {day}
          </div>
        ))}
        {Array.from({ length: lead }, (_, index) => (
          <div key={`blank-${index}`} aria-hidden />
        ))}
        {days.map((day) => {
          const level = levelFor(day.amount, cuts)
          const future = day.date > today
          const label = `${format(parseISO(day.date), 'EEEE, MMMM d')}: ${day.amount > 0 ? formatAmount(day.amount) : 'nothing spent'}`
          return (
            <button
              key={day.date}
              type="button"
              aria-label={label}
              aria-pressed={selected === day.date}
              disabled={future}
              onClick={() => onSelect(selected === day.date ? null : day.date)}
              className={cn(
                'flex aspect-square min-h-9 items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition',
                future ? 'bg-transparent text-slate-300' : LEVELS[level],
                selected === day.date && 'ring-2 ring-slate-900 ring-offset-1',
                day.date === today && selected !== day.date && 'ring-2 ring-blue-600',
              )}
            >
              {Number(day.date.slice(8, 10))}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-slate-500" aria-hidden>
        Less
        {LEVELS.map((level) => (
          <span key={level} className={cn('size-3 rounded', level.split(' ')[0])} />
        ))}
        More
      </div>
      <TableView
        caption="Spending by day"
        columns={['Day', 'Spent']}
        rows={days
          .filter((day) => day.amount > 0)
          .map((day) => ({ key: day.date, cells: [format(parseISO(day.date), 'EEE, MMM d'), formatAmount(day.amount)] }))}
      />
    </div>
  )
}
