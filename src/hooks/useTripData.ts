import { useCallback } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getTripDetails, type TripDetails } from '@/services/tripService'

/**
 * Loads a trip with its members, categories and totals. While a different
 * trip's data is still cached (navigating between trips), `data` is undefined
 * rather than showing the wrong trip.
 */
export function useTripData(tripId: string) {
  const load = useCallback(() => getTripDetails(tripId), [tripId])
  const state = useAsync<TripDetails>(load)
  const data = state.data?.trip.id === tripId ? state.data : undefined
  return { ...state, data }
}
