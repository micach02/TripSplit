import { isValid, parse, subYears } from 'date-fns'
import { todayIso } from '@/utils/tripStatus'

/**
 * Best guesses from a receipt's recognised text (on-device OCR): the total, the
 * date and the shop's name. Every guess may be null; the person confirms them.
 */

export interface ReceiptGuess {
  /** Decimal string with two decimals, e.g. "1700.00" */
  amount: string | null
  /** 'yyyy-MM-dd' */
  date: string | null
  merchant: string | null
}

const MONEY = /(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{2})|\d+\.\d{2})(?!\d)/g
// Strongest first. "Subtotal", "total items", "total qty", VAT/tax lines are excluded below.
const TOTAL_LABELS = [
  /grand\s*total/i,
  /amount\s*due|total\s*due|balance\s*due|total\s*amount|amount\s*payable/i,
  /\btotal\b/i,
]
const NOT_TOTAL = /sub\s*-?\s*total|total\s*(items?|qty|quantity|disc|discount|savings?)|vat|tax|change|cash\s*tendered|tendered/i

function toAmount(text: string): string | null {
  const value = Number(text.replace(/[,\s]/g, ''))
  return Number.isFinite(value) && value > 0 && value < 10_000_000 ? value.toFixed(2) : null
}

function lastMoney(line: string): string | null {
  const matches = [...line.matchAll(MONEY)]
  return matches.length ? toAmount(matches[matches.length - 1][1]) : null
}

function findAmount(lines: string[]): string | null {
  for (const label of TOTAL_LABELS) {
    // The last matching line: totals come after item lines.
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (!label.test(line) || NOT_TOTAL.test(line)) continue
      const onLine = lastMoney(line)
      if (onLine) return onLine
      // "TOTAL" on one line, the number on the next
      const next = lines[i + 1] ? lastMoney(lines[i + 1]) : null
      if (next) return next
    }
  }
  return null
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec'
const DATE_PATTERNS: Array<{ regex: RegExp; formats: string[] }> = [
  { regex: /\b(\d{4}-\d{1,2}-\d{1,2})\b/, formats: ['yyyy-M-d'] },
  // Philippine and US receipts write month first; fall back to day first when that can't be right.
  { regex: /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/, formats: ['M/d/yyyy', 'd/M/yyyy'] },
  { regex: /\b(\d{1,2}\/\d{1,2}\/\d{2})\b/, formats: ['M/d/yy', 'd/M/yy'] },
  { regex: /\b(\d{1,2}-\d{1,2}-\d{4})\b/, formats: ['M-d-yyyy', 'd-M-yyyy'] },
  { regex: new RegExp(`\\b((?:${MONTHS})[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})\\b`, 'i'), formats: ['MMM d, yyyy', 'MMM d yyyy', 'MMMM d, yyyy', 'MMMM d yyyy'] },
  { regex: new RegExp(`\\b(\\d{1,2}[\\s-](?:${MONTHS})[a-z]*[\\s-]\\d{2,4})\\b`, 'i'), formats: ['d MMM yyyy', 'd-MMM-yyyy', 'd MMMM yyyy', 'd-MMM-yy'] },
]

function findDate(text: string, today: string): string | null {
  const latest = parse(today, 'yyyy-MM-dd', new Date())
  const earliest = subYears(latest, 2)
  for (const { regex, formats } of DATE_PATTERNS) {
    const match = regex.exec(text)
    if (!match) continue
    const raw = match[1].replace(/\./g, '').replace(/\s+/g, ' ')
    for (const pattern of formats) {
      const date = parse(raw, pattern, new Date())
      if (isValid(date) && date <= latest && date >= earliest) {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    }
  }
  return null
}

const NOT_A_NAME = /receipt|invoice|official|\btin\b|vat\s*reg|\bmin\b|serial|welcome|thank|cashier|terminal|\bpos\b|date|time|tel\b|phone|www\.|\.com|^\W*$/i

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s&'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
}

function findMerchant(lines: string[]): string | null {
  for (const line of lines.slice(0, 6)) {
    const letters = (line.match(/\p{L}/gu) ?? []).length
    if (letters < 3 || letters / line.length < 0.5 || line.length > 40 || NOT_A_NAME.test(line)) continue
    const cleaned = line.replace(/[^\p{L}\p{N}&'.\s-]/gu, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length < 3) continue
    return cleaned === cleaned.toUpperCase() ? titleCase(cleaned) : cleaned
  }
  return null
}

export function parseReceiptText(text: string, today: string = todayIso()): ReceiptGuess {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return {
    amount: findAmount(lines),
    date: findDate(text, today),
    merchant: findMerchant(lines),
  }
}
