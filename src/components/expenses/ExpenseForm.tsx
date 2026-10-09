import { useId, useState, type FormEvent } from 'react'
import { CircleAlert, X } from 'lucide-react'
import { CategoryPicker } from '@/components/expenses/CategoryPicker'
import { ReceiptPicker } from '@/components/expenses/ReceiptPicker'
import { SplitEditor } from '@/components/expenses/SplitEditor'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { TextareaField } from '@/components/forms/TextareaField'
import { TextField } from '@/components/forms/TextField'
import { MemberCheckboxChips, MemberRadioChips } from '@/components/members/MemberChips'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/cn'
import { CURRENCY_CODES, getCurrency } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import { exchangeRates } from '@/services/exchangeRates'
import {
  applyReceiptChange,
  saveExpense,
  type ExpenseWithSplits,
  type ReceiptChange,
} from '@/services/expenseService'
import { RECEIPT_MAX_BYTES } from '@/services/storageService'
import type { TripMemberWithProfile } from '@/services/tripService'
import type { Category, Trip } from '@/types/models'
import {
  calculateSplits,
  defaultSplitValues,
  SPLIT_METHOD_LABELS,
  type SplitMethod,
} from '@/utils/calculations/expenseSplit'
import { convertMinor, formatMoney, parseMoneyInput, toDecimalString, toMinor } from '@/utils/calculations/money'
import { formatDate } from '@/utils/format'
import { prepareReceiptImage } from '@/utils/image'
import { todayIso } from '@/utils/tripStatus'
import { collectErrors, type FieldErrors } from '@/utils/validation'

interface ExpenseFormProps {
  trip: Trip
  members: TripMemberWithProfile[]
  categories: Category[]
  currentUserId: string
  /** Present when editing */
  expense?: ExpenseWithSplits
  /** `receiptFailed`: the expense saved, but the receipt change didn't */
  onSaved: (expenseId: string, result: { receiptFailed: boolean }) => void
  onCancel: () => void
}

interface FormState {
  amount: string
  currency: string
  rate: string
  description: string
  categoryId: string
  paidBy: string
  participants: string[]
  method: SplitMethod
  values: Record<string, string>
  expenseDate: string
  notes: string
}

type Field = 'amount' | 'rate' | 'description' | 'category' | 'paidBy' | 'split'

type RateLookup =
  | { status: 'idle' | 'loading' | 'unavailable' }
  | { status: 'done'; date: string; source: 'ecb' | 'manual' }

const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/
const METHOD_OPTIONS = (Object.keys(SPLIT_METHOD_LABELS) as SplitMethod[]).map((value) => ({
  value,
  label: SPLIT_METHOD_LABELS[value],
}))

function splitValueText(method: SplitMethod, value: number | null, currency: string): string {
  if (value === null || method === 'equal') return ''
  if (method === 'custom') return toDecimalString(toMinor(value, currency), currency)
  return String(value)
}

function initialState({ trip, members, currentUserId, expense }: ExpenseFormProps): FormState {
  if (!expense) {
    return {
      amount: '',
      currency: trip.currency,
      rate: '',
      description: '',
      categoryId: '',
      paidBy: members.some((m) => m.userId === currentUserId) ? currentUserId : (members[0]?.userId ?? ''),
      participants: members.map((m) => m.userId),
      method: 'equal',
      values: {},
      expenseDate: todayIso(),
      notes: '',
    }
  }
  const method = expense.expense_splits[0]?.split_type ?? 'equal'
  return {
    amount: toDecimalString(toMinor(expense.amount, expense.currency), expense.currency),
    currency: expense.currency,
    rate: expense.currency === trip.currency ? '' : String(expense.exchange_rate),
    description: expense.description,
    categoryId: expense.category_id,
    paidBy: expense.paid_by,
    participants: expense.expense_splits.map((split) => split.user_id),
    method,
    values: Object.fromEntries(
      expense.expense_splits.map((split) => [split.user_id, splitValueText(method, split.value, expense.currency)]),
    ),
    expenseDate: expense.expense_date,
    notes: expense.notes ?? '',
  }
}

function safeConvert(minor: number, from: string, to: string, rate: string): number {
  try {
    return convertMinor(minor, from, to, rate)
  } catch {
    return 0
  }
}

export function ExpenseForm(props: ExpenseFormProps) {
  const { trip, members, categories, currentUserId, expense, onSaved, onCancel } = props
  const [state, setState] = useState<FormState>(() => initialState(props))
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(Boolean(expense?.notes))
  // An existing expense keeps the rate it was saved with until the traveler asks for the official one.
  const [rateTouched, setRateTouched] = useState(Boolean(expense))
  const [rateLookup, setRateLookup] = useState<RateLookup>({ status: 'idle' })
  const [receipt, setReceipt] = useState<ReceiptChange>({ kind: 'keep' })
  const amountId = useId()

  const tripCurrency = trip.currency
  const foreign = state.currency !== tripCurrency
  const amountResult = state.amount.trim() ? parseMoneyInput(state.amount, state.currency) : null
  const originalMinor = amountResult?.ok ? amountResult.minor : 0
  const rateText = state.rate.trim()
  const rateValid = !foreign || (RATE_PATTERN.test(rateText) && Number(rateText) > 0)
  const totalMinor =
    originalMinor === 0 ? 0 : !foreign ? originalMinor : rateValid ? safeConvert(originalMinor, state.currency, tripCurrency, rateText) : 0

  // Participants in roster order (and any former members still on an old expense)
  const selectedMembers = members.filter((member) => state.participants.includes(member.userId))
  const calculation = calculateSplits({
    method: state.method,
    participants: selectedMembers.map((member) => ({ userId: member.userId, value: state.values[member.userId] ?? '' })),
    totalMinor,
    originalMinor,
    expenseCurrency: state.currency,
  })

  /** Which error each piece of state can clear once the traveler changes it. */
  const ERROR_FOR: Partial<Record<keyof FormState, Field>> = {
    amount: 'amount',
    currency: 'rate',
    rate: 'rate',
    description: 'description',
    categoryId: 'category',
    paidBy: 'paidBy',
    participants: 'split',
    method: 'split',
    values: 'split',
  }

  function clearErrors(keys: Array<keyof FormState>) {
    const fields = keys.map((key) => ERROR_FOR[key]).filter((field): field is Field => Boolean(field))
    if (fields.some((field) => errors[field])) {
      setErrors((current) => {
        const next = { ...current }
        for (const field of fields) delete next[field]
        return next
      })
    }
  }

  const update = (changes: Partial<FormState>) => {
    clearErrors(Object.keys(changes) as Array<keyof FormState>)
    setState((current) => ({ ...current, ...changes }))
  }

  function evenValues(method: SplitMethod, participantIds: string[], current: FormState): Record<string, string> {
    const amount = current.amount.trim() ? parseMoneyInput(current.amount, current.currency) : null
    const defaults = defaultSplitValues(method, participantIds.length, amount?.ok ? amount.minor : 0, current.currency)
    return Object.fromEntries(participantIds.map((id, index) => [id, defaults[index]]))
  }

  /**
   * Fills in the official rate for the expense date. Unless `force` is set, a
   * rate the traveler typed themselves is left alone.
   */
  async function lookUpRate(currency: string, date: string, force = false) {
    if (currency === tripCurrency) return
    if (!force && rateTouched) return
    setRateLookup({ status: 'loading' })
    const quote = await exchangeRates.getRate(currency, tripCurrency, date || todayIso())
    if (!quote) {
      setRateLookup({ status: 'unavailable' })
      return
    }
    setState((current) => (current.currency === currency ? { ...current, rate: quote.rate } : current))
    setRateLookup({ status: 'done', date: quote.date, source: quote.source })
    if (force) setRateTouched(false)
  }

  function changeCurrency(code: string) {
    update({ currency: code, rate: '' })
    setRateTouched(false)
    setRateLookup({ status: 'idle' })
    if (code !== tripCurrency) void lookUpRate(code, state.expenseDate, true)
  }

  function changeRate(rate: string) {
    update({ rate })
    setRateTouched(true)
  }

  function changeDate(expenseDate: string) {
    update({ expenseDate })
    if (foreign) void lookUpRate(state.currency, expenseDate)
  }

  function changeMethod(method: SplitMethod) {
    clearErrors(['method'])
    setState((current) => {
      const ids = members.filter((m) => current.participants.includes(m.userId)).map((m) => m.userId)
      return { ...current, method, values: evenValues(method, ids, current) }
    })
  }

  function setParticipants(next: string[]) {
    clearErrors(['participants'])
    setState((current) => {
      const ids = members.filter((m) => next.includes(m.userId)).map((m) => m.userId)
      // A different group invalidates typed amounts/percentages: start again from an even split.
      const values =
        current.method === 'shares'
          ? Object.fromEntries(ids.map((id) => [id, current.values[id] || '1']))
          : current.method === 'equal'
            ? {}
            : evenValues(current.method, ids, current)
      return { ...current, participants: ids, values }
    })
  }

  function toggleParticipant(userId: string) {
    setParticipants(
      state.participants.includes(userId)
        ? state.participants.filter((id) => id !== userId)
        : [...state.participants, userId],
    )
  }

  const allSelected = selectedMembers.length === members.length

  /** Runs after the expense itself is saved; false when the receipt couldn't be stored. */
  async function saveReceipt(expenseId: string): Promise<boolean> {
    if (receipt.kind === 'keep') return true
    try {
      await applyReceiptChange(
        { id: expenseId, trip_id: trip.id, receipt_url: expense?.receipt_url ?? null },
        receipt.kind === 'replace'
          ? { kind: 'replace', image: await prepareReceiptImage(receipt.file, RECEIPT_MAX_BYTES) }
          : receipt,
      )
      return true
    } catch (error) {
      if (import.meta.env.DEV) console.error('[TripSplit] receipt', error)
      return false
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = collectErrors<Field>({
      amount: !state.amount.trim()
        ? 'Enter an amount.'
        : amountResult && !amountResult.ok
          ? amountResult.error
          : originalMinor <= 0
            ? 'The amount must be more than zero.'
            : null,
      rate: !foreign
        ? null
        : !rateValid
          ? `Enter how many ${tripCurrency} one ${state.currency} is worth.`
          : totalMinor <= 0
            ? 'With this rate the amount rounds to zero.'
            : null,
      description: state.description.trim() ? null : 'Add a short description.',
      category: state.categoryId ? null : 'Pick a category.',
      paidBy: state.paidBy ? null : 'Choose who paid.',
      split: calculation.ok ? null : calculation.error,
    })
    setErrors(found ?? {})
    setFormError(null)
    if (found) return focusFirstInvalid(form)

    setSaving(true)
    try {
      const id = await saveExpense({
        id: expense?.id,
        tripId: trip.id,
        categoryId: state.categoryId,
        description: state.description.trim(),
        amount: toDecimalString(originalMinor, state.currency),
        currency: state.currency,
        exchangeRate: foreign ? rateText : '1',
        paidBy: state.paidBy,
        expenseDate: state.expenseDate || todayIso(),
        notes: state.notes,
        splits: calculation.splits.map((split) => ({
          userId: split.userId,
          splitType: state.method,
          value: split.value,
          amount: toDecimalString(split.amount, tripCurrency),
        })),
      })
      if (foreign) exchangeRates.remember(state.currency, tripCurrency, rateText)
      onSaved(id, { receiptFailed: !(await saveReceipt(id)) })
    } catch (error) {
      setFormError(getErrorMessage(error))
      setSaving(false)
    }
  }

  const symbol = getCurrency(state.currency).symbol.trim()

  return (
    <form onSubmit={handleSubmit} noValidate className="min-h-dvh sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-white sm:min-h-0 sm:rounded-3xl sm:shadow-sm sm:ring-1 sm:ring-slate-900/5">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white/95 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur sm:rounded-t-3xl sm:px-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex size-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close without saving"
          >
            <X className="size-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{expense ? 'Edit expense' : 'Add expense'}</h1>
            <p className="truncate text-xs text-slate-500">{trip.name}</p>
          </div>
        </header>

        <div className="flex-1 space-y-7 px-4 py-5 sm:px-6">
          {formError && <Alert tone="error">{formError}</Alert>}

          {/* Amount */}
          <div>
            <label htmlFor={amountId} className="text-sm font-semibold text-slate-700">
              Amount
            </label>
            <div className="mt-1.5 flex items-stretch gap-2">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-slate-400">
                  {symbol}
                </span>
                <input
                  id={amountId}
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  autoFocus={!expense}
                  value={state.amount}
                  onChange={(event) => update({ amount: event.target.value })}
                  placeholder="0.00"
                  aria-invalid={errors.amount ? true : undefined}
                  aria-describedby={errors.amount ? `${amountId}-error` : undefined}
                  className={cn(
                    'h-16 w-full rounded-2xl border bg-white pr-4 pl-14 text-3xl font-extrabold text-slate-900 tabular-nums placeholder:text-slate-300 focus:ring-4 focus:outline-none',
                    errors.amount
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/15',
                  )}
                />
              </div>
              <select
                aria-label="Currency"
                value={state.currency}
                onChange={(event) => changeCurrency(event.target.value)}
                className="h-16 shrink-0 rounded-2xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            {errors.amount && (
              <p id={`${amountId}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                {errors.amount}
              </p>
            )}

            {foreign && (
              <div className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>1 {state.currency} =</span>
                  <input
                    inputMode="decimal"
                    value={state.rate}
                    onChange={(event) => changeRate(event.target.value)}
                    placeholder={rateLookup.status === 'loading' ? '…' : '0.00'}
                    aria-label={`Exchange rate: ${tripCurrency} per ${state.currency}`}
                    aria-invalid={errors.rate ? true : undefined}
                    className="h-11 w-32 rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold tabular-nums focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none sm:text-sm"
                  />
                  <span>{tripCurrency}</span>
                </label>
                <p className="mt-2 text-sm text-slate-500">
                  ≈ <strong className="text-slate-900 tabular-nums">{formatMoney(totalMinor, tripCurrency)}</strong> in
                  the trip currency
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500" aria-live="polite">
                  <span>
                    {rateLookup.status === 'loading'
                      ? 'Looking up the official rate…'
                      : rateTouched
                        ? 'Using your rate.'
                        : rateLookup.status === 'done' && rateLookup.source === 'ecb'
                          ? `European Central Bank rate for ${formatDate(rateLookup.date)}.`
                          : rateLookup.status === 'done'
                            ? 'Live rates are unavailable — this is the rate you used last time.'
                            : rateLookup.status === 'unavailable'
                              ? 'Live rates are unavailable — enter the rate you got.'
                              : null}
                  </span>
                  {(rateTouched || rateLookup.status === 'unavailable') && (
                    <button
                      type="button"
                      onClick={() => void lookUpRate(state.currency, state.expenseDate, true)}
                      className="rounded font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Use official rate
                    </button>
                  )}
                </p>
                {errors.rate && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                    <CircleAlert className="size-4 shrink-0" aria-hidden />
                    {errors.rate}
                  </p>
                )}
              </div>
            )}
          </div>

          <TextField
            label="Description"
            value={state.description}
            onChange={(event) => update({ description: event.target.value })}
            error={errors.description}
            placeholder="Dinner at Lau Pa Sat"
            maxLength={120}
            enterKeyHint="next"
            autoCapitalize="sentences"
          />

          <CategoryPicker
            categories={categories}
            value={state.categoryId}
            onChange={(categoryId) => update({ categoryId })}
            error={errors.category}
          />

          <MemberRadioChips
            label="Paid by"
            members={members}
            currentUserId={currentUserId}
            value={state.paidBy}
            onChange={(paidBy) => update({ paidBy })}
          />

          <section className="space-y-4" aria-label="Split">
            <MemberCheckboxChips
              label="Split between"
              members={members}
              currentUserId={currentUserId}
              selected={new Set(state.participants)}
              onToggle={toggleParticipant}
              action={
                members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setParticipants(allSelected ? [] : members.map((m) => m.userId))}
                    className="rounded-md px-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {allSelected ? 'Clear' : 'Select all'}
                  </button>
                )
              }
            />

            {selectedMembers.length > 0 && (
              <>
                <SegmentedControl label="Split method" value={state.method} options={METHOD_OPTIONS} onChange={changeMethod} />
                <SplitEditor
                  method={state.method}
                  participants={selectedMembers}
                  currentUserId={currentUserId}
                  values={state.values}
                  onValueChange={(userId, value) => {
                    clearErrors(['values'])
                    setState((current) => ({ ...current, values: { ...current.values, [userId]: value } }))
                  }}
                  calculation={calculation}
                  expenseCurrency={state.currency}
                  tripCurrency={tripCurrency}
                />
              </>
            )}
            {errors.split && (
              <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                {errors.split}
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label="Date"
              type="date"
              value={state.expenseDate}
              onChange={(event) => changeDate(event.target.value)}
            />
          </div>

          <ReceiptPicker existingPath={expense?.receipt_url ?? null} value={receipt} onChange={setReceipt} />

          {showNotes ? (
            <TextareaField
              label="Notes"
              value={state.notes}
              onChange={(event) => update({ notes: event.target.value })}
              maxLength={1000}
              rows={3}
              placeholder="Anything worth remembering about this expense"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="rounded-md text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              + Add notes
            </button>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:rounded-b-3xl sm:px-6">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500">Total</p>
              <p className="truncate text-lg font-extrabold text-slate-900 tabular-nums">
                {formatMoney(totalMinor, tripCurrency)}
              </p>
            </div>
            <Button type="submit" size="lg" loading={saving} className="min-w-36">
              {expense ? 'Save changes' : 'Save expense'}
            </Button>
          </div>
        </footer>
      </div>
    </form>
  )
}
