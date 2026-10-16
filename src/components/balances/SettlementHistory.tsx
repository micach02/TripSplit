import { useState } from 'react'
import { ArrowRight, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { memberName, type TripContextValue } from '@/hooks/useTripContext'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import type { SettlementRecord } from '@/services/ledgerService'
import { deleteSettlement, PAYMENT_METHOD_LABELS } from '@/services/settlementService'
import { formatDate } from '@/utils/format'

interface SettlementHistoryProps {
  context: TripContextValue
  settlements: SettlementRecord[]
  /** After a payment was removed */
  onChanged: () => void
}

/** Every payment recorded between people, newest first, with undo for whoever may remove it. */
export function SettlementHistory({ context, settlements, onChanged }: SettlementHistoryProps) {
  const { money, currentUserId, isOwner } = context
  const toast = useToast()
  const [toDelete, setToDelete] = useState<SettlementRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const total = settlements.reduce((sum, settlement) => sum + settlement.amount, 0)

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteSettlement(toDelete.id)
      setToDelete(null)
      toast.success('Payment removed. Balances updated.')
      onChanged()
    } catch (error) {
      setDeleteError(getErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card id="payments" className="scroll-mt-24 overflow-hidden">
      <CardHeader
        title="Payments recorded"
        description={
          settlements.length > 0
            ? `${settlements.length === 1 ? '1 payment' : `${settlements.length} payments`} · ${money.format(total)} paid back`
            : 'When someone pays someone back — cash, GCash, bank transfer — record it, and it shows here.'
        }
      />
      {settlements.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {settlements.map((settlement) => {
            const from = context.memberById.get(settlement.fromUserId)
            const to = context.memberById.get(settlement.toUserId)
            const canDelete = isOwner || settlement.createdBy === currentUserId
            return (
              <li key={settlement.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  <Avatar name={from?.profile.full_name} src={from?.profile.avatar_url} size="sm" decorative />
                  <ArrowRight className="size-3.5 text-slate-400" aria-hidden />
                  <Avatar name={to?.profile.full_name} src={to?.profile.avatar_url} size="sm" decorative />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{memberName(context, settlement.fromUserId, { you: true })}</span>{' '}
                    paid{' '}
                    <span className="font-semibold text-slate-900">{memberName(context, settlement.toUserId, { you: true })}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <Badge>{PAYMENT_METHOD_LABELS[settlement.method]}</Badge>
                    <span>{formatDate(settlement.date)}</span>
                    <span>· recorded by {memberName(context, settlement.createdBy, { you: true })}</span>
                  </p>
                  {settlement.note && <p className="mt-1 text-sm text-slate-600">{settlement.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <p className="font-bold text-emerald-700 tabular-nums">{money.format(settlement.amount)}</p>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setToDelete(settlement)
                      }}
                      className="rounded-lg p-3 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:p-2"
                      aria-label="Remove this payment"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        error={deleteError}
        title="Remove this payment?"
        confirmLabel="Remove payment"
      >
        <p>Balances will go back to how they were before it was recorded.</p>
      </ConfirmDialog>
    </Card>
  )
}
