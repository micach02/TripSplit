import { useMemo, useSyncExternalStore } from 'react'
import { outboxSnapshot, subscribeOutbox, type OutboxItem } from '@/lib/outbox'

const EMPTY: OutboxItem[] = []

/** Your expenses waiting to sync (optionally for one budget or trip). */
export function useOutbox(userId: string | undefined, tripId?: string): OutboxItem[] {
  const items = useSyncExternalStore(subscribeOutbox, outboxSnapshot, () => EMPTY)
  return useMemo(
    () => items.filter((item) => item.userId === userId && (!tripId || item.tripId === tripId)),
    [items, userId, tripId],
  )
}
