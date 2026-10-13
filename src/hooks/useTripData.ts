import { useCallback } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { cacheGet, cacheSet, isOfflineError } from '@/lib/offlineCache'
import { getTripDetails, type TripDetails } from '@/services/tripService'

/**
 * Loads a trip with its members, categories and totals. Offline, it falls back
 * to the last copy loaded on this device (`fromCache`), so expenses can still
 * be logged. While a different trip's data is still cached (navigating
 * between trips), `data` is undefined rather than showing the wrong trip.
 */
export function useTripData(tripId: string) {
  const load = useCallback(async (): Promise<TripDetails> => {
    try {
      const details = await getTripDetails(tripId)
      cacheSet(`trip:${tripId}`, details)
      return details
    } catch (error) {
      const cached = isOfflineError(error) ? cacheGet<TripDetails>(`trip:${tripId}`) : null
      if (cached) return { ...cached, fromCache: true }
      throw error
    }
  }, [tripId])
  const state = useAsync<TripDetails>(load)
  const data = state.data?.trip.id === tripId ? state.data : undefined
  return { ...state, data }
}
