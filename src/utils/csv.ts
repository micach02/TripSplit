/**
 * CSV for spreadsheets (Excel, Google Sheets, Numbers). Cells are quoted when
 * needed, and text that a spreadsheet would run as a formula (=, +, @, or a
 * dash that isn't a negative number) is defused with a leading apostrophe.
 */

export type CsvCell = string | number | null | undefined

const FORMULA_START = /^[=+@\t\r]|^-(?!\d)/

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = value
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\n\r]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

/** Saves the CSV as a file. The BOM makes Excel read ₱ and accents correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "Groceries & Food" → "groceries-food" for file names. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-') || 'export'
  )
}
