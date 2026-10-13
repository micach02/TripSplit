import { useState } from 'react'
import { Pencil, Repeat2, Trash2 } from 'lucide-react'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'
import { ReceiptThumbnail } from '@/components/expenses/ReceiptThumbnail'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { memberName, type TripContextValue } from '@/hooks/useTripContext'
import { getErrorMessage } from '@/lib/errors'
import { editExpensePath, newExpensePath } from '@/routes/paths'
import { deleteExpense, type ExpenseWithSplits } from '@/services/expenseService'
import { SPLIT_METHOD_LABELS } from '@/utils/calculations/expenseSplit'
import { formatAmount, toMinor } from '@/utils/calculations/money'
import { formatDate, formatRelative } from '@/utils/format'
import { PAYMENT_METHOD_LABELS } from '@/utils/paymentMethods'
import { canEditExpense } from '@/utils/permissions'

type DetailsContext = Pick<
  TripContextValue,
  'trip' | 'currentUserId' | 'isOwner' | 'memberById' | 'categoryById' | 'money' | 'copy' | 'effectiveStatus'
>

interface ExpenseDetailsDialogProps {
  expense: ExpenseWithSplits | null
  context: DetailsContext
  onClose: () => void
  onDeleted: (expenseId: string) => void
}

function splitValueLabel(splitType: string, value: number | null, currency: string): string | null {
  if (value === null) return null
  if (splitType === 'percentage') return `${value}%`
  if (splitType === 'shares') return `${value} ${value === 1 ? 'share' : 'shares'}`
  if (splitType === 'custom') return formatAmount(value, currency)
  return null
}

export function ExpenseDetailsDialog({ expense, context, onClose, onDeleted }: ExpenseDetailsDialogProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setConfirming(false)
    setError(null)
    onClose()
  }

  if (!expense) return <Dialog open={false} onClose={close} title="" />

  const category = context.categoryById.get(expense.category_id)
  const tripCurrency = context.trip.currency
  const foreign = expense.currency !== tripCurrency
  const editable = canEditExpense(expense, context.currentUserId, context.isOwner)
  const method = expense.expense_splits[0]?.split_type ?? 'equal'
  // "Add again" makes a new expense: not on a completed trip or archived budget
  const canAddAgain = context.effectiveStatus !== 'completed'

  async function handleDelete() {
    if (!expense) return
    setDeleting(true)
    setError(null)
    try {
      await deleteExpense(expense)
      setConfirming(false)
      onDeleted(expense.id)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open
      onClose={close}
      title={expense.description}
      description={`${category?.name ?? 'Expense'} · ${formatDate(expense.expense_date)}`}
      footer={
        confirming ? (
          <>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete expense
            </Button>
          </>
        ) : editable || canAddAgain ? (
          <>
            {editable && (
              <Button variant="ghost" onClick={() => setConfirming(true)} icon={<Trash2 className="size-4" aria-hidden />}>
                Delete
              </Button>
            )}
            {canAddAgain && (
              <ButtonLink
                to={`${newExpensePath(context.trip.id)}?from=${expense.id}`}
                variant={editable ? 'outline' : 'primary'}
                icon={<Repeat2 className="size-4" aria-hidden />}
              >
                Add again
              </ButtonLink>
            )}
            {editable && (
              <ButtonLink to={editExpensePath(context.trip.id, expense.id)} icon={<Pencil className="size-4" aria-hidden />}>
                Edit
              </ButtonLink>
            )}
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        {confirming && (
          <Alert tone="warning" title="Delete this expense?">
            It will be removed for everyone in this {context.copy.noun} and balances will update.
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <CategoryIcon icon={category?.icon ?? '📦'} color={category?.color ?? '#64748b'} size="lg" />
          <div>
            <p className="text-2xl font-extrabold tabular-nums">
              {context.money.format(toMinor(expense.converted_amount, tripCurrency))}
            </p>
            {foreign && (
              <p className="text-sm text-slate-500 tabular-nums">
                {formatAmount(expense.amount, expense.currency)} at {expense.exchange_rate} {tripCurrency}/{expense.currency}
              </p>
            )}
            {context.money.converted && (
              <p className="text-xs text-slate-500 tabular-nums">
                Recorded as {formatAmount(expense.converted_amount, tripCurrency)}
              </p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Paid by</dt>
            <dd className="font-semibold text-slate-900">{memberName(context, expense.paid_by, { you: true })}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Split</dt>
            <dd className="font-semibold text-slate-900">{SPLIT_METHOD_LABELS[method]}</dd>
          </div>
          {expense.payment_method && (
            <div>
              <dt className="text-slate-500">Paid with</dt>
              <dd className="font-semibold text-slate-900">{PAYMENT_METHOD_LABELS[expense.payment_method]}</dd>
            </div>
          )}
          {expense.recurring_id && (
            <div>
              <dt className="text-slate-500">Repeats</dt>
              <dd className="font-semibold text-slate-900">Monthly</dd>
            </div>
          )}
        </dl>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            Shared by {expense.expense_splits.length} {expense.expense_splits.length === 1 ? 'person' : 'people'}
          </h3>
          <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {expense.expense_splits.map((split) => {
              const member = context.memberById.get(split.user_id)
              const valueLabel = splitValueLabel(split.split_type, split.value, expense.currency)
              return (
                <li key={split.user_id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={member?.profile.full_name} src={member?.profile.avatar_url} size="sm" decorative />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                    {memberName(context, split.user_id, { you: true })}
                    {valueLabel && <span className="ml-1.5 font-normal text-slate-500">{valueLabel}</span>}
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {context.money.format(toMinor(split.amount, tripCurrency))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {expense.notes && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Notes</h3>
            <p className="text-sm whitespace-pre-line text-slate-600">{expense.notes}</p>
          </div>
        )}

        {expense.receipt_url && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Receipt</h3>
            <ReceiptThumbnail key={expense.receipt_url} path={expense.receipt_url} title={expense.description} />
          </div>
        )}

        <p className="text-xs text-slate-500">
          Added by {memberName(context, expense.created_by, { you: true })} {formatRelative(expense.created_at)}
          {!editable && ` · Only the person who added or paid for it, or the ${context.copy.noun} owner, can change it.`}
        </p>
      </div>
    </Dialog>
  )
}
