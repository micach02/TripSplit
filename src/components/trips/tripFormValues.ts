import type { Trip } from '@/types/models'
import { toDecimalString, toMinor } from '@/utils/calculations/money'

export interface TripFormValues {
  name: string
  destination: string
  startDate: string
  endDate: string
  /** Decimal text as typed, in the trip currency */
  budget: string
  currency: string
  description: string
}

export type CoverChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; file: File }

export function emptyTripFormValues(currency: string): TripFormValues {
  return { name: '', destination: '', startDate: '', endDate: '', budget: '', currency, description: '' }
}

export function tripToFormValues(
  trip: Pick<Trip, 'name' | 'destination' | 'start_date' | 'end_date' | 'budget' | 'currency' | 'description'>,
): TripFormValues {
  const budgetMinor = toMinor(trip.budget, trip.currency)
  return {
    name: trip.name,
    destination: trip.destination ?? '',
    startDate: trip.start_date,
    endDate: trip.end_date,
    budget: budgetMinor > 0 ? toDecimalString(budgetMinor, trip.currency) : '',
    currency: trip.currency,
    description: trip.description ?? '',
  }
}
