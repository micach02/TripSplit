import { useCallback } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getTripLedger } from '@/services/ledgerService'
import type { Trip } from '@/types/models'

/** The trip's full ledger (expenses, settlements, category budgets) in trip-currency minor units. */
export function useTripLedger(trip: Pick<Trip, 'id' | 'currency'>) {
  const load = useCallback(() => getTripLedger(trip.id, trip.currency), [trip.id, trip.currency])
  return useAsync(load)
}
