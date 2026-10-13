import { CloudOff, TriangleAlert, X } from 'lucide-react'
import { useCurrentUser } from '@/hooks/useAuth'
import { useOutbox } from '@/hooks/useOutbox'
import { removeOutbox } from '@/lib/outbox'
import { toMinor } from '@/utils/calculations/money'
import { formatDate } from '@/utils/format'

/** Expenses saved on this phone that haven't reached the server yet. */
export function OutboxList({ tripId, format }: { tripId: string; format: (minor: number) => string }) {
  const { user } = useCurrentUser()
  const items = useOutbox(user.id, tripId)
  if (items.length === 0) return null

  return (
    <section aria-label="Waiting to sync" className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-slate-900/5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CloudOff className="size-4" aria-hidden />
        Waiting to sync ({items.length})
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Saved on this phone; sent automatically when you’re online.</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{item.draft.description}</p>
              <p className="text-xs text-slate-500">{formatDate(item.draft.expenseDate)}</p>
              {item.error && (
                <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-red-600">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  Couldn’t save: {item.error}
                </p>
              )}
            </div>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {format(toMinor(Number(item.total), item.currency))}
            </span>
            {item.error && (
              <button
                type="button"
                onClick={() => void removeOutbox(item.id)}
                className="rounded-lg p-3 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:p-2"
                aria-label={`Remove ${item.draft.description} from this phone`}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
