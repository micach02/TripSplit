import type { Trip } from '@/types/models'
import { toDecimalString, toMinor } from '@/utils/calculations/money'
import type { TripKind } from '@/utils/tripKind'

export interface TripFormValues {
  kind: TripKind
  name: string
  destination: string
  /** Budgets: the day they started (set automatically) */
  startDate: string
  endDate: string
  /** Decimal text as typed, in the trip currency. Budgets: per month. */
  budget: string
  currency: string
  description: string
  /** Budgets: carry unspent money into the next month */
  rollover: boolean
}

export type CoverChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; file: File }

export function emptyTripFormValues(currency: string, kind: TripKind = 'trip'): TripFormValues {
  return { kind, name: '', destination: '', startDate: '', endDate: '', budget: '', currency, description: '', rollover: false }
}

export function tripToFormValues(
  trip: Pick<Trip, 'kind' | 'name' | 'destination' | 'start_date' | 'end_date' | 'budget' | 'currency' | 'description' | 'rollover'>,
): TripFormValues {
  const budgetMinor = toMinor(trip.budget, trip.currency)
  return {
    kind: trip.kind,
    name: trip.name,
    destination: trip.destination ?? '',
    startDate: trip.start_date,
    endDate: trip.end_date ?? '',
    budget: budgetMinor > 0 ? toDecimalString(budgetMinor, trip.currency) : '',
    currency: trip.currency,
    description: trip.description ?? '',
    rollover: trip.rollover,
  }
}
