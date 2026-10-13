import { getErrorMessage } from '@/lib/errors'
import { isOfflineError } from '@/lib/offlineCache'
import { listOutbox, putOutbox, removeOutbox, type OutboxItem } from '@/lib/outbox'
import { applyReceiptChange, saveExpense, type ExpenseDraft } from '@/services/expenseService'

export interface SyncResult {
  synced: number
  /** Still waiting (offline) */
  waiting: number
  /** The server refused these; they stay in the outbox with a message */
  failed: number
}

let running: Promise<SyncResult> | null = null

/**
 * Sends your waiting offline expenses, oldest first. Stops at the first
 * network failure (still offline); a refusal from the server is recorded on
 * that item and the rest carry on. Safe to call often: concurrent calls share one run.
 */
export function syncOutbox(userId: string): Promise<SyncResult> {
  running ??= (async () => {
    const result: SyncResult = { synced: 0, waiting: 0, failed: 0 }
    const items = (await listOutbox()).filter((item) => item.userId === userId)
    for (const [index, item] of items.entries()) {
      try {
        const id = await saveExpense(item.draft)
        if (item.receipt) {
          const file = new File([item.receipt], 'receipt.jpg', { type: item.receipt.type || 'image/jpeg' })
          await applyReceiptChange({ id, trip_id: item.tripId, receipt_url: null }, { kind: 'replace', image: file }).catch(
            () => undefined, // the expense is in; the photo can be re-added from the expense
          )
        }
        await removeOutbox(item.id)
        result.synced += 1
      } catch (error) {
        if (isOfflineError(error)) {
          result.waiting = items.length - index
          break
        }
        await putOutbox({ ...item, attempts: item.attempts + 1, error: getErrorMessage(error) })
        result.failed += 1
      }
    }
    return result
  })().finally(() => {
    running = null
  })
  return running
}

/** Queues an expense to sync later. */
export async function queueExpense(
  userId: string,
  draft: ExpenseDraft & { clientId: string },
  details: { tripName: string; currency: string; total: string },
  receipt: Blob | null,
): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: draft.clientId,
    userId,
    tripId: draft.tripId,
    tripName: details.tripName,
    currency: details.currency,
    total: details.total,
    draft,
    receipt,
    createdAt: new Date().toISOString(),
    attempts: 0,
    error: null,
  }
  await putOutbox(item)
  return item
}
