import type { Trip } from '@/types/models'
import { formatDateRange } from '@/utils/format'

export type TripKind = Trip['kind']

/** The words for a trip vs an everyday budget, so screens can share code. */
export interface KindCopy {
  noun: string
  Noun: string
  /** One member: "traveler" / "person" */
  member: string
  /** Several: "travelers" / "people" */
  members: string
  Members: string
}

const COPY: Record<TripKind, KindCopy> = {
  trip: { noun: 'trip', Noun: 'Trip', member: 'traveler', members: 'travelers', Members: 'Travelers' },
  budget: { noun: 'budget', Noun: 'Budget', member: 'person', members: 'people', Members: 'People' },
}

export function kindCopy(kind: TripKind): KindCopy {
  return COPY[kind]
}

export function isBudget(trip: Pick<Trip, 'kind'>): boolean {
  return trip.kind === 'budget'
}

/** When it happens: "Nov 3–8, 2026" for a trip, "Monthly budget" for a budget. */
export function timeframe(trip: { kind: TripKind; startDate: string; endDate: string | null }): string {
  if (trip.kind === 'budget' || !trip.endDate) return 'Monthly budget'
  return formatDateRange(trip.startDate, trip.endDate)
}

/** "1 traveler", "3 people" */
export function memberCount(kind: TripKind, count: number): string {
  const copy = COPY[kind]
  return `${count} ${count === 1 ? copy.member : copy.members}`
}
