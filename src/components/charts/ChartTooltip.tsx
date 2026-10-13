import type { ReactNode } from 'react'

export interface TooltipRow {
  key: string
  color: string
  /** Formatted value — the strong, high-contrast element */
  value: string
  label: string
}

/** Tooltip body: value first, series name second, keyed by a short line in the series colour. */
export function ChartTooltipBox({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="pointer-events-none min-w-36 rounded-xl bg-surface px-3 py-2.5 text-sm shadow-lg ring-1 ring-slate-900/10">
      {title && <p className="mb-1.5 text-xs font-semibold text-slate-500">{title}</p>}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="font-bold text-slate-900 tabular-nums">{row.value}</span>
            <span className="text-slate-500">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
