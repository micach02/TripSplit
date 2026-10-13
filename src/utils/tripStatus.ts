import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Trip, TripStatus } from '@/types/models'

/** Today as a calendar date (yyyy-MM-dd) in the traveler's time zone. */
export function todayIso(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

/**
 * A trip's status as travelers see it. "Completed" is an explicit owner action
 * (after settling up); otherwise the dates decide, so the status never goes
 * stale. A trip whose end date has passed stays active until it's completed.
 */
export function getTripStatus(trip: Pick<Trip, 'status' | 'start_date'>, today: string = todayIso()): TripStatus {
  if (trip.status === 'completed') return 'completed'
  return today < trip.start_date ? 'upcoming' : 'active'
}

/** Budgets have no end date, so they never end on their own. */
export function hasTripEnded(trip: Pick<Trip, 'end_date'>, today: string = todayIso()): boolean {
  return trip.end_date !== null && today > trip.end_date
}

/** Inclusive number of days: Nov 3–8 → 6. */
export function tripLengthInDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1
}

/** The status to store when a trip is created or its dates change. */
export function initialTripStatus(startDate: string, today: string = todayIso()): TripStatus {
  return today < startDate ? 'upcoming' : 'active'
}

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Completed',
}
