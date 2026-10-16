import type { ReactNode } from 'react'

interface TableViewProps {
  caption: string
  columns: string[]
  rows: Array<{ key: string; cells: ReactNode[] }>
  /** Disclosure label; defaults to "View as table" */
  label?: string
}

/** Every chart's accessible twin: the same numbers as a plain table. */
export function TableView({ caption, columns, rows, label = 'View as table' }: TableViewProps) {
  return (
    <details className="group mt-3">
      <summary className="tap-target w-fit cursor-pointer rounded text-xs font-semibold text-primary-600 hover:text-primary-700">
        {label}
      </summary>
      {/* mt-4 clears the summary's enlarged hit area */}
      <div className="mt-4 max-h-72 overflow-auto rounded-xl ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
            <tr>
              {columns.map((column, index) => (
                <th key={column} scope="col" className={index === 0 ? 'px-3 py-2 font-semibold' : 'px-3 py-2 text-right font-semibold'}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => (
                  <td key={index} className={index === 0 ? 'px-3 py-2 text-slate-700' : 'px-3 py-2 text-right text-slate-900 tabular-nums'}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
