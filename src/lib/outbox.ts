import type { ExpenseDraft } from '@/services/expenseService'

/**
 * Expenses saved without a connection wait here (IndexedDB, so receipt photos
 * fit) until they sync. Each keeps the id it will have on the server, so a
 * retried sync never creates a duplicate.
 */

export interface OutboxItem {
  /** The expense's id-to-be */
  id: string
  /** Who saved it: only they can sync or see it (devices can be shared) */
  userId: string
  tripId: string
  tripName: string
  /** Trip currency, for showing the amount */
  currency: string
  /** Decimal string in the trip currency */
  total: string
  draft: ExpenseDraft
  receipt: Blob | null
  createdAt: string
  attempts: number
  /** Set when the server refused it (not just "offline"); shown to the person */
  error: string | null
}

const DB_NAME = 'tripsplit'
const STORE = 'outbox'

let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const request = work(database.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

// A tiny change feed so screens showing "waiting to sync" stay current.
let snapshot: OutboxItem[] = []
const listeners = new Set<() => void>()

async function refreshSnapshot(): Promise<void> {
  try {
    const items = await run<OutboxItem[]>('readonly', (store) => store.getAll())
    snapshot = items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } catch {
    snapshot = []
  }
  for (const listener of listeners) listener()
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) void refreshSnapshot()
  return () => listeners.delete(listener)
}

export function outboxSnapshot(): OutboxItem[] {
  return snapshot
}

export async function listOutbox(): Promise<OutboxItem[]> {
  await refreshSnapshot()
  return snapshot
}

export async function putOutbox(item: OutboxItem): Promise<void> {
  await run('readwrite', (store) => store.put(item))
  await refreshSnapshot()
}

export async function removeOutbox(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id))
  await refreshSnapshot()
}

/** Wipe the outbox (sign-out on a shared device). */
export async function clearOutbox(): Promise<void> {
  await run('readwrite', (store) => store.clear())
  await refreshSnapshot()
}
