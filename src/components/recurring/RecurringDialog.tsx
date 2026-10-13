import { useState, type FormEvent } from 'react'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { SelectField } from '@/components/forms/SelectField'
import { TextField } from '@/components/forms/TextField'
import { MemberCheckboxChips, MemberRadioChips } from '@/components/members/MemberChips'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { TripContextValue } from '@/hooks/useTripContext'
import { getCurrency } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import { createRecurring, updateRecurring, type RecurringInput } from '@/services/recurringService'
import type { PaymentMethod, RecurringExpense, RecurringMode } from '@/types/models'
import { parseMoneyInput, toDecimalString, toMinor } from '@/utils/calculations/money'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/utils/paymentMethods'
import { ordinalDay } from '@/utils/recurring'
import { todayIso } from '@/utils/tripStatus'

type Context = Pick<TripContextValue, 'trip' | 'members' | 'categories' | 'currentUserId'>

interface RecurringDialogProps {
  open: boolean
  context: Context
  /** Editing; absent when adding */
  existing?: RecurringExpense | null
  onClose: () => void
  onSaved: () => void
}

const MODES: Array<{ value: RecurringMode; label: string }> = [
  { value: 'remind', label: 'Remind me' },
  { value: 'auto', label: 'Add it automatically' },
]

type Field = 'description' | 'amount' | 'category' | 'participants'

function Form({ context, existing, onClose, onSaved }: Omit<RecurringDialogProps, 'open'>) {
  const { trip, members, categories, currentUserId } = context
  const shared = members.length > 1
  const [description, setDescription] = useState(existing?.description ?? '')
  const [amount, setAmount] = useState(
    existing ? toDecimalString(toMinor(existing.amount, trip.currency), trip.currency) : '',
  )
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? '')
  const [day, setDay] = useState(existing?.day_of_month ?? Number(todayIso().slice(8, 10)))
  const [paidBy, setPaidBy] = useState(existing?.paid_by ?? currentUserId)
  const [participants, setParticipants] = useState<string[]>(existing?.participant_ids ?? members.map((m) => m.userId))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(existing?.payment_method ?? '')
  const [mode, setMode] = useState<RecurringMode>(existing?.mode ?? 'remind')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const parsed = parseMoneyInput(amount, trip.currency)
    const found: Partial<Record<Field, string>> = {}
    if (!description.trim()) found.description = 'What is it? e.g. Rent, Internet, Netflix.'
    if (!parsed.ok) found.amount = parsed.error
    else if (parsed.minor <= 0) found.amount = 'The amount must be more than zero.'
    if (!categoryId) found.category = 'Pick a category.'
    if (participants.length === 0) found.participants = 'Choose who shares it.'
    setErrors(found)
    if (Object.keys(found).length > 0 || !parsed.ok) return focusFirstInvalid(form)

    const input: RecurringInput = {
      categoryId,
      description,
      amount: toDecimalString(parsed.minor, trip.currency),
      paidBy,
      participantIds: participants,
      paymentMethod: paymentMethod || null,
      dayOfMonth: day,
      mode,
    }
    setSaving(true)
    setFormError(null)
    try {
      if (existing) await updateRecurring(existing.id, input)
      else await createRecurring(trip.id, input)
      onSaved()
    } catch (error) {
      setFormError(getErrorMessage(error))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors.description}
        placeholder="Rent, Meralco, Netflix…"
        maxLength={120}
        autoCapitalize="sentences"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label={`Amount (${getCurrency(trip.currency).symbol.trim()})`}
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={errors.amount}
          placeholder="0.00"
          hint={mode === 'remind' ? 'An estimate is fine — you confirm the real amount each month.' : undefined}
        />
        <SelectField label="Every month on the" value={day} onChange={(event) => setDay(Number(event.target.value))}>
          {Array.from({ length: 31 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {ordinalDay(value)}
              {value > 28 ? ' (or the last day)' : ''}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField
        label="Category"
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        error={errors.category}
      >
        <option value="">Choose a category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {`${category.icon}  ${category.name}`}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Paid with (optional)"
        value={paymentMethod}
        onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | '')}
      >
        <option value="">Not set</option>
        {PAYMENT_METHODS.map((method) => (
          <option key={method} value={method}>
            {PAYMENT_METHOD_LABELS[method]}
          </option>
        ))}
      </SelectField>
      {shared && (
        <>
          <MemberRadioChips label="Paid by" members={members} currentUserId={currentUserId} value={paidBy} onChange={setPaidBy} />
          <div>
            <MemberCheckboxChips
              label="Split equally between"
              members={members}
              currentUserId={currentUserId}
              selected={new Set(participants)}
              onToggle={(userId) =>
                setParticipants((current) =>
                  current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
                )
              }
            />
            {errors.participants && <p className="mt-1.5 text-sm text-red-600">{errors.participants}</p>}
          </div>
        </>
      )}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Each month</p>
        <SegmentedControl label="Each month" value={mode} options={MODES} onChange={setMode} />
        <p className="mt-1.5 text-xs text-slate-500">
          {mode === 'auto'
            ? 'Added for you on the day (the next time someone opens TripSplit).'
            : 'Shows up as a reminder on the day, so you can enter the real amount or skip it.'}
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? 'Save changes' : 'Add recurring expense'}
        </Button>
      </div>
    </form>
  )
}

/** Add or edit a monthly recurring expense (rent, bills, subscriptions). */
export function RecurringDialog({ open, context, existing, onClose, onSaved }: RecurringDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? 'Edit recurring expense' : 'New recurring expense'}
      description="Repeats every month."
    >
      {/* Remount per open so it starts from the right values */}
      {open && <Form key={existing?.id ?? 'new'} context={context} existing={existing} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}
