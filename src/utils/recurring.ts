import { endOfMonth, format, parse } from 'date-fns'
import { monthOf, shiftMonth } from '@/utils/budgetPeriod'

/**
 * Monthly recurring expenses, mirroring tripsplit.post_due_recurring in the
 * database: an occurrence falls on `day` of each month (31 → the month's last
 * day), from the first one on or after `startsOn`.
 */

export interface RecurringSchedule {
  dayOfMonth: number
  /** 'yyyy-MM-dd' */
  startsOn: string
  /** First day of the latest month already added or skipped ('yyyy-MM-dd'), or null */
  lastPeriod: string | null
}

/** The occurrence in `month` ('yyyy-MM'), clamped to the month's length. */
export function recurringDate(month: string, day: number): string {
  const first = parse(`${month}-01`, 'yyyy-MM-dd', new Date())
  const last = Number(format(endOfMonth(first), 'd'))
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`
}

function firstOpenMonth(schedule: RecurringSchedule): string {
  return schedule.lastPeriod ? shiftMonth(monthOf(schedule.lastPeriod), 1) : monthOf(schedule.startsOn)
}

/** Months ('yyyy-MM') whose occurrence has arrived and isn't added or skipped yet (at most 24). */
export function duePeriods(schedule: RecurringSchedule, today: string): string[] {
  const due: string[] = []
  for (let month = firstOpenMonth(schedule), steps = 0; steps < 24; month = shiftMonth(month, 1), steps++) {
    const date = recurringDate(month, schedule.dayOfMonth)
    if (date > today) break
    if (date >= schedule.startsOn) due.push(month)
  }
  return due
}

/** The next occurrence still to come after today ('yyyy-MM-dd'). */
export function nextOccurrence(schedule: RecurringSchedule, today: string): string {
  let month = firstOpenMonth(schedule)
  for (let steps = 0; steps < 60; steps++, month = shiftMonth(month, 1)) {
    const date = recurringDate(month, schedule.dayOfMonth)
    if (date > today && date >= schedule.startsOn) return date
  }
  return recurringDate(month, schedule.dayOfMonth)
}

/** "1st", "2nd", "23rd", "31st" */
export function ordinalDay(day: number): string {
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][day % 10] ?? 'th')
  return `${day}${suffix}`
}
