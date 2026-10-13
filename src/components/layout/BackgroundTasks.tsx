import { useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { emitDataChanged } from '@/lib/dataEvents'
import { postDueRecurring } from '@/services/recurringService'
import { syncOutbox } from '@/services/syncService'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * Work that happens while you use the app: automatic recurring expenses that
 * have come due are added (once per visit), and expenses saved offline are sent
 * when the connection is back. Renders nothing.
 */
export function BackgroundTasks() {
  const { user } = useCurrentUser()
  const toast = useToast()

  useEffect(() => {
    let cancelled = false

    postDueRecurring()
      .then((count) => {
        if (cancelled || count === 0) return
        toast.success(`Added ${plural(count, 'recurring expense', 'recurring expenses')}.`)
        emitDataChanged()
      })
      .catch(() => undefined) // offline or not set up: next visit will catch up

    const sync = () => {
      void syncOutbox(user.id)
        .then((result) => {
          if (cancelled) return
          if (result.synced > 0) {
            toast.success(`${plural(result.synced, 'expense', 'expenses')} saved offline ${result.synced === 1 ? 'is' : 'are'} now synced.`)
            emitDataChanged()
          }
          if (result.failed > 0) {
            toast.error(`${plural(result.failed, 'offline expense', 'offline expenses')} couldn’t be saved — see the Expenses tab.`)
          }
        })
        .catch(() => undefined)
    }
    sync()
    window.addEventListener('online', sync)
    return () => {
      cancelled = true
      window.removeEventListener('online', sync)
    }
  }, [user.id, toast])

  return null
}
