import { addMonths, differenceInCalendarDays, endOfMonth, format, parse, parseISO } from 'date-fns'
import { todayIso } from '@/utils/tripStatus'

/**
 * Calendar months for everyday budgets. A month is written 'yyyy-MM'; dates
 * are 'yyyy-MM-dd' like everywhere else.
 */

export interface MonthPeriod {
  /** 'yyyy-MM' */
  month: string
  /** First and last day, 'yyyy-MM-dd' */
  start: string
  end: string
  /** "October 2026" */
  label: string
  /** "Oct 2026" */
  shortLabel: string
  /** "October" */
  name: string
  /** "Oct" */
  shortName: string
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** '2026-10-14' → '2026-10' */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function currentMonth(today: string = todayIso()): string {
  return monthOf(today)
}

/** A 'yyyy-MM' string, or null when `value` isn't one. */
export function parseMonth(value: string | null | undefined): string | null {
  return value && MONTH.test(value) ? value : null
}

function firstDay(month: string): Date {
  return parse(`${month}-01`, 'yyyy-MM-dd', new Date())
}

export function monthPeriod(month: string): MonthPeriod {
  const first = firstDay(month)
  return {
    month,
    start: format(first, 'yyyy-MM-dd'),
    end: format(endOfMonth(first), 'yyyy-MM-dd'),
    label: format(first, 'MMMM yyyy'),
    shortLabel: format(first, 'MMM yyyy'),
    name: format(first, 'MMMM'),
    shortName: format(first, 'MMM'),
  }
}

export function shiftMonth(month: string, delta: number): string {
  return format(addMonths(firstDay(month), delta), 'yyyy-MM')
}

/** Keeps `month` within [earliest, latest] ('yyyy-MM' strings compare in order). */
export function clampMonth(month: string, earliest: string, latest: string): string {
  if (month < earliest) return earliest
  if (month > latest) return latest
  return month
}

/** Up to `count` months ending at `last`, oldest first, never before `earliest`. */
export function recentMonths(last: string, count: number, earliest: string): string[] {
  const months: string[] = []
  for (let month = last; months.length < count && month >= earliest; month = shiftMonth(month, -1)) {
    months.unshift(month)
  }
  return months
}

/**
 * Days of the month to average over: the whole month once it's over, the days
 * so far in the current month, and at least 1.
 */
export function elapsedDays(period: Pick<MonthPeriod, 'start' | 'end'>, today: string = todayIso()): number {
  if (today < period.start) return 1
  const last = today < period.end ? today : period.end
  return differenceInCalendarDays(parseISO(last), parseISO(period.start)) + 1
}

/** Days left in the month including today; 0 once it's over. */
export function daysLeft(period: Pick<MonthPeriod, 'start' | 'end'>, today: string = todayIso()): number {
  if (today > period.end) return 0
  const from = today < period.start ? period.start : today
  return differenceInCalendarDays(parseISO(period.end), parseISO(from)) + 1
}
