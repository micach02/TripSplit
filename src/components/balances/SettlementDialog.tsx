import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { SelectField } from '@/components/forms/SelectField'
import { TextareaField } from '@/components/forms/TextareaField'
import { TextField } from '@/components/forms/TextField'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { memberName, type TripContextValue } from '@/hooks/useTripContext'
import { cn } from '@/lib/cn'
import { getCurrency } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import { PAYMENT_METHOD_LABELS, recordSettlement } from '@/services/settlementService'
import { PAYMENT_METHODS } from '@/utils/paymentMethods'
import type { PaymentMethod } from '@/types/models'
import { parseMoneyInput, toDecimalString } from '@/utils/calculations/money'
import { todayIso } from '@/utils/tripStatus'

export interface SettlementPrefill {
  fromUserId: string
  toUserId: string
  /** Trip-currency minor units */
  amount: number
}

interface SettlementDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  context: Pick<TripContextValue, 'trip' | 'members' | 'memberById' | 'currentUserId' | 'money'>
  prefill: SettlementPrefill | null
}

const METHODS = PAYMENT_METHODS

function SettlementForm({ onClose, onSaved, context, prefill }: Omit<SettlementDialogProps, 'open'>) {
  const { trip, members, money } = context
  const others = members.find((m) => m.userId !== context.currentUserId)?.userId ?? ''
  const [from, setFrom] = useState(prefill?.fromUserId ?? context.currentUserId)
  const [to, setTo] = useState(prefill?.toUserId ?? others)
  const [amount, setAmount] = useState(prefill ? toDecimalString(prefill.amount, trip.currency) : '')
  const [method, setMethod] = useState<PaymentMethod>('gcash')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ amount?: string; to?: string; form?: string }>({})
  const [saving, setSaving] = useState(false)

  const parsed = amount.trim() ? parseMoneyInput(amount, trip.currency) : null
  const symbol = getCurrency(trip.currency).symbol.trim()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = {
      to: from === to ? 'Choose two different people.' : undefined,
      amount: !parsed ? 'Enter the amount paid.' : !parsed.ok ? parsed.error : parsed.minor === 0 ? 'The amount must be more than zero.' : undefined,
    }
    setErrors(next)
    if (next.to || next.amount || !parsed?.ok) return

    setSaving(true)
    try {
      await recordSettlement({
        tripId: trip.id,
        tripCurrency: trip.currency,
        fromUserId: from,
        toUserId: to,
        amount: toDecimalString(parsed.minor, trip.currency),
        method,
        date,
        note,
      })
      onSaved()
    } catch (error) {
      setErrors({ form: getErrorMessage(error) })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {errors.form && <Alert tone="error">{errors.form}</Alert>}

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <SelectField label="Who paid" value={from} onChange={(event) => setFrom(event.target.value)}>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {memberName(context, member.userId, { you: true })}
            </option>
          ))}
        </SelectField>
        <ArrowRight className="mb-3.5 size-5 text-slate-400" aria-hidden />
        <SelectField label="Paid to" value={to} onChange={(event) => setTo(event.target.value)} error={errors.to}>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {memberName(context, member.userId, { you: true })}
            </option>
          ))}
        </SelectField>
      </div>

      <TextField
        label={`Amount (${symbol})`}
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={errors.amount}
        placeholder="0.00"
        hint={
          money.converted && parsed?.ok && parsed.minor > 0
            ? `≈ ${money.format(parsed.minor)} · settlements are recorded in ${trip.currency}`
            : `Recorded in ${trip.currency}, the currency everything here is tracked in.`
        }
      />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Payment method</legend>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={method === value}
              onClick={() => setMethod(value)}
              className={cn(
                'min-h-11 rounded-full px-4 text-sm font-semibold transition',
                method === value ? 'bg-brand-600 text-white' : 'bg-surface text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {PAYMENT_METHOD_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      <TextField label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <TextareaField
        label="Note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Partial payment for the hotel"
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Record payment
        </Button>
      </div>
    </form>
  )
}

/** Records a payment between two travelers. Remounts its form each time it opens. */
export function SettlementDialog({ open, onClose, onSaved, context, prefill }: SettlementDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a payment"
      description="Log money that changed hands to settle up."
    >
      {open && (
        <SettlementForm
          key={prefill ? `${prefill.fromUserId}-${prefill.toUserId}-${prefill.amount}` : 'blank'}
          onClose={onClose}
          onSaved={onSaved}
          context={context}
          prefill={prefill}
        />
      )}
    </Dialog>
  )
}
