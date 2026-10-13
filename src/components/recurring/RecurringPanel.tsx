import { useCallback, useState } from 'react'
import { BellRing, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import { RecurringDialog } from '@/components/recurring/RecurringDialog'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useAsync } from '@/hooks/useAsync'
import type { TripContextValue } from '@/hooks/useTripContext'
import { useToast } from '@/hooks/useToast'
import { useDataChanged } from '@/lib/dataEvents'
import { getErrorMessage } from '@/lib/errors'
import { newExpensePath } from '@/routes/paths'
import { deleteRecurring, listRecurring, skipRecurring, updateRecurring } from '@/services/recurringService'
import type { RecurringExpense } from '@/types/models'
import { monthPeriod } from '@/utils/budgetPeriod'
import { toMinor } from '@/utils/calculations/money'
import { formatDate } from '@/utils/format'
import { duePeriods, nextOccurrence, ordinalDay, recurringDate } from '@/utils/recurring'
import { todayIso } from '@/utils/tripStatus'

const schedule = (r: RecurringExpense) => ({ dayOfMonth: r.day_of_month, startsOn: r.starts_on, lastPeriod: r.last_period })

/** Rent, bills, subscriptions: due reminders first, then the list. */
export function RecurringPanel({ context }: { context: TripContextValue }) {
  const { trip, money, categoryById, currentUserId, isOwner, effectiveStatus } = context
  const toast = useToast()
  const load = useCallback(() => listRecurring(trip.id), [trip.id])
  const { data, reload } = useAsync(load)
  useDataChanged(reload)
  const [editing, setEditing] = useState<RecurringExpense | null | 'new'>(null)
  const [deleting, setDeleting] = useState<RecurringExpense | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const today = todayIso()
  const archived = effectiveStatus === 'completed'

  const canManage = (r: RecurringExpense) => r.created_by === currentUserId || isOwner
  const due = (data ?? [])
    .filter((r) => r.active && r.mode === 'remind')
    .flatMap((r) => duePeriods(schedule(r), today).map((month) => ({ recurring: r, month })))

  async function act(id: string, work: () => Promise<void>, done: string) {
    setBusy(id)
    try {
      await work()
      toast.success(done)
      reload()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Recurring"
        description="Rent, bills and subscriptions — add them once."
        action={
          !archived && (
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')} icon={<Plus className="size-4" aria-hidden />}>
              Add
            </Button>
          )
        }
      />
      <CardBody className="space-y-4">
        {!data ? (
          <ListSkeleton rows={2} label="Loading recurring expenses…" />
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing yet. Add your rent, internet or Netflix and TripSplit will add or remind you every month.
          </p>
        ) : (
          <>
            {due.length > 0 && !archived && (
              <ul className="space-y-2" aria-label="Due now">
                {due.map(({ recurring, month }) => (
                  <li key={`${recurring.id}:${month}`} className="rounded-2xl bg-orange-50 p-3 ring-1 ring-orange-200">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <BellRing className="size-4 shrink-0 text-orange-700" aria-hidden />
                      {recurring.description} is due
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {formatDate(recurringDate(month, recurring.day_of_month))} · about{' '}
                      {money.format(toMinor(recurring.amount, trip.currency))}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <ButtonLink size="sm" to={`${newExpensePath(trip.id)}?recurring=${recurring.id}&month=${month}`}>
                        Add it
                      </ButtonLink>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy === `${recurring.id}:${month}`}
                        onClick={() =>
                          act(`${recurring.id}:${month}`, () => skipRecurring(recurring.id, month), `Skipped ${monthPeriod(month).name}.`)
                        }
                      >
                        Skip {monthPeriod(month).name}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <ul className="divide-y divide-slate-100">
              {data.map((recurring) => {
                const category = categoryById.get(recurring.category_id)
                return (
                  <li key={recurring.id} className="flex items-center gap-3 py-3">
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
                      {category?.icon ?? <Repeat className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-semibold text-slate-900">
                        <span className="truncate">{recurring.description}</span>
                        {!recurring.active ? (
                          <Badge>Paused</Badge>
                        ) : recurring.mode === 'auto' ? (
                          <Badge tone="primary">Auto</Badge>
                        ) : (
                          <Badge>Reminder</Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Monthly on the {ordinalDay(recurring.day_of_month)}
                        {recurring.active && ` · next ${formatDate(nextOccurrence(schedule(recurring), today))}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {money.format(toMinor(recurring.amount, trip.currency))}
                    </span>
                    {canManage(recurring) && !archived && (
                      <div className="flex">
                        <button
                          type="button"
                          onClick={() => setEditing(recurring)}
                          className="rounded-lg p-3 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:p-2"
                          aria-label={`Edit ${recurring.description}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            act(
                              recurring.id,
                              () => updateRecurring(recurring.id, { active: !recurring.active }),
                              recurring.active ? `${recurring.description} paused.` : `${recurring.description} resumed.`,
                            )
                          }
                          disabled={busy === recurring.id}
                          className="rounded-lg p-3 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:p-2"
                          aria-label={recurring.active ? `Pause ${recurring.description}` : `Resume ${recurring.description}`}
                        >
                          {recurring.active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(recurring)}
                          className="rounded-lg p-3 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:p-2"
                          aria-label={`Delete ${recurring.description}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardBody>

      <RecurringDialog
        open={editing !== null}
        context={context}
        existing={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          toast.success(editing === 'new' ? 'Recurring expense added.' : 'Recurring expense saved.')
          setEditing(null)
          reload()
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting
          setDeleting(null)
          if (target) void act(target.id, () => deleteRecurring(target.id), `${target.description} deleted.`)
        }}
        title={`Delete ${deleting?.description ?? ''}?`}
        confirmLabel="Delete"
      >
        <p>It stops repeating. Expenses it already added stay.</p>
      </ConfirmDialog>
    </Card>
  )
}
