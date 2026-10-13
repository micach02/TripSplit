import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, HandCoins, Plus, Trash2 } from 'lucide-react'
import { SettlementDialog } from '@/components/balances/SettlementDialog'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { memberName, useTripContext } from '@/hooks/useTripContext'
import { useTripLedger } from '@/hooks/useTripLedger'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { tripPath } from '@/routes/paths'
import type { SettlementRecord } from '@/services/ledgerService'
import { deleteSettlement, PAYMENT_METHOD_LABELS } from '@/services/settlementService'
import { formatDate } from '@/utils/format'

export default function TripSettlementsPage() {
  const context = useTripContext()
  const { trip, money, currentUserId, isOwner } = context
  const toast = useToast()
  const ledger = useTripLedger(trip)
  const [recording, setRecording] = useState(false)
  const [toDelete, setToDelete] = useState<SettlementRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteSettlement(toDelete.id)
      setToDelete(null)
      toast.success('Payment removed. Balances updated.')
      ledger.reload()
    } catch (error) {
      setDeleteError(getErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  if (ledger.error && !ledger.data) {
    return <Alert tone="error" title="We couldn't load settlements">{getErrorMessage(ledger.error)}</Alert>
  }
  if (!ledger.data) return <PageSkeleton heading={false} label="Loading settlements…" />

  const settlements = ledger.data.settlements
  const total = settlements.reduce((sum, settlement) => sum + settlement.amount, 0)

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader
          title="Payments between people"
          description={
            settlements.length > 0
              ? `${settlements.length === 1 ? '1 payment' : `${settlements.length} payments`} · ${money.format(total)} settled`
              : undefined
          }
          action={
            <Button size="sm" onClick={() => setRecording(true)} icon={<Plus className="size-4" aria-hidden />}>
              Record payment
            </Button>
          }
        />
        <div className="mt-4 border-t border-slate-100">
          {settlements.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No payments recorded yet"
              description={
                <>
                  When someone pays someone back — cash, GCash, bank transfer — record it here. Check{' '}
                  <Link to={tripPath(trip.id, 'balances')} className="font-semibold text-blue-600 hover:text-blue-700">
                    Balances
                  </Link>{' '}
                  to see who should pay whom.
                </>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
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
                        <span className="font-semibold text-slate-900">
                          {memberName(context, settlement.fromUserId, { you: true })}
                        </span>{' '}
                        paid{' '}
                        <span className="font-semibold text-slate-900">
                          {memberName(context, settlement.toUserId, { you: true })}
                        </span>
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
        </div>
      </Card>

      <SettlementDialog
        open={recording}
        onClose={() => setRecording(false)}
        onSaved={() => {
          setRecording(false)
          toast.success('Payment recorded. Balances updated.')
          ledger.reload()
        }}
        context={context}
        prefill={null}
      />

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
    </div>
  )
}
