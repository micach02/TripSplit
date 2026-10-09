import { format, formatDistanceToNowStrict, isSameMonth, isSameYear, parseISO } from 'date-fns'

/**
 * Trip and expense dates are calendar dates ("2026-11-03") with no time zone.
 * parseISO reads them as local midnight, so they never shift a day.
 */
export function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value
}

/** "Nov 3, 2026" */
export function formatDate(value: string | Date): string {
  return format(toDate(value), 'MMM d, yyyy')
}

/** "November 3, 2026" */
export function formatLongDate(value: string | Date): string {
  return format(toDate(value), 'MMMM d, yyyy')
}

/**
 * Compact trip date range:
 *   Nov 3–8, 2026 · Oct 30 – Nov 4, 2026 · Dec 28, 2026 – Jan 3, 2027
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const from = toDate(start)
  const to = toDate(end)

  if (!isSameYear(from, to)) return `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`
  if (!isSameMonth(from, to)) return `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`
  if (from.getDate() === to.getDate()) return format(from, 'MMM d, yyyy')
  return `${format(from, 'MMM d')}–${format(to, 'd, yyyy')}`
}

/** "5 minutes ago" */
export function formatRelative(value: string | Date): string {
  return formatDistanceToNowStrict(toDate(value), { addSuffix: true })
}

/** First name for friendly greetings: "Michael Reyes" → "Michael". */
export function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? ''
}

/** Up to two initials for avatar fallbacks: "Michael Reyes" → "MR". */
export function initials(name: string | null | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}
