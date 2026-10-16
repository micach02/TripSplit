import { useId, useMemo, useState, type FormEvent } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Check, CircleAlert, ScanText, Sparkles, X } from 'lucide-react'
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
import { isOfflineError } from '@/lib/offlineCache'
import { exchangeRates } from '@/services/exchangeRates'
import {
  applyReceiptChange,
  saveExpense,
  type ExpenseWithSplits,
  type ReceiptChange,
} from '@/services/expenseService'
import { RECEIPT_MAX_BYTES } from '@/services/storageService'
import { queueExpense } from '@/services/syncService'
import type { TripMemberWithProfile } from '@/services/tripService'
import type { Category, PaymentMethod, Trip } from '@/types/models'
import {
  calculateSplits,
  defaultSplitValues,
  SPLIT_METHOD_LABELS,
  type SplitMethod,
} from '@/utils/calculations/expenseSplit'
import { convertMinor, formatMoney, parseMoneyInput, toDecimalString, toMinor } from '@/utils/calculations/money'
import { formatDate } from '@/utils/format'
import { splitValueText } from '@/utils/expenseTemplates'
import { prepareReceiptImage } from '@/utils/image'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/utils/paymentMethods'
import type { ReceiptGuess } from '@/utils/receiptParser'
import { buildSuggestions, frequentCategoryIds, matchSuggestions, type PastExpense, type Suggestion } from '@/utils/suggestions'
import { todayIso } from '@/utils/tripStatus'
import { collectErrors, type FieldErrors } from '@/utils/validation'

interface ExpenseFormProps {
  trip: Trip
  members: TripMemberWithProfile[]
  categories: Category[]
  currentUserId: string
  /** Present when editing */
  expense?: ExpenseWithSplits
  /** Prefills a new expense: "Add again", or a recurring reminder */
  template?: ExpenseTemplate
  /** Your past expenses here (newest first): suggestions and category order */
  history?: PastExpense[]
  /** `receiptFailed`: the expense saved, but the receipt change didn't. `queued`: saved on this device to sync later. */
  onSaved: (expenseId: string, result: { receiptFailed: boolean; queued: boolean }) => void
  onCancel: () => void
  /** Quick add: lets you switch to another budget or trip */
  onChangeTrip?: () => void
}

export interface ExpenseTemplate {
  description: string
  categoryId: string
  /** Decimal string in `currency` */
  amount: string
  currency: string
  exchangeRate?: string
  paymentMethod: PaymentMethod | null
  paidBy?: string
  participants?: string[]
  method?: SplitMethod
  values?: Record<string, string>
  expenseDate?: string
  notes?: string
  recurringId?: string
  recurringMonth?: string
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
  paymentMethod: PaymentMethod | ''
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

function initialState({ trip, members, currentUserId, expense, template }: ExpenseFormProps): FormState {
  const me = members.some((m) => m.userId === currentUserId) ? currentUserId : (members[0]?.userId ?? '')
  const memberIds = new Set(members.map((m) => m.userId))
  if (!expense && template) {
    const participants = (template.participants ?? []).filter((id) => memberIds.has(id))
    return {
      amount: template.amount,
      currency: template.currency,
      rate: template.currency === trip.currency ? '' : (template.exchangeRate ?? ''),
      description: template.description,
      categoryId: template.categoryId,
      paidBy: template.paidBy && memberIds.has(template.paidBy) ? template.paidBy : me,
      participants: participants.length ? participants : members.map((m) => m.userId),
      method: participants.length ? (template.method ?? 'equal') : 'equal',
      values: participants.length ? (template.values ?? {}) : {},
      expenseDate: template.expenseDate ?? todayIso(),
      notes: template.notes ?? '',
      paymentMethod: template.paymentMethod ?? '',
    }
  }
  if (!expense) {
    return {
      amount: '',
      currency: trip.currency,
      rate: '',
      description: '',
      categoryId: '',
      paidBy: me,
      participants: members.map((m) => m.userId),
      method: 'equal',
      values: {},
      expenseDate: todayIso(),
      notes: '',
      paymentMethod: '',
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
    paymentMethod: expense.payment_method ?? '',
  }
}

type ScanState =
  | { status: 'idle' }
  | { status: 'reading'; progress: number }
  | { status: 'done'; guess: ReceiptGuess }
  | { status: 'failed' }

const dayBefore = (date: string) => format(addDays(parseISO(date), -1), 'yyyy-MM-dd')

function safeConvert(minor: number, from: string, to: string, rate: string): number {
  try {
    return convertMinor(minor, from, to, rate)
  } catch {
    return 0
  }
}

export function ExpenseForm(props: ExpenseFormProps) {
  const { trip, members, categories, currentUserId, expense, template, history, onSaved, onCancel, onChangeTrip } = props
  const [state, setState] = useState<FormState>(() => initialState(props))
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(Boolean(expense?.notes))
  // An existing expense keeps the rate it was saved with until the traveler asks for the official one.
  const [rateTouched, setRateTouched] = useState(Boolean(expense))
  const [rateLookup, setRateLookup] = useState<RateLookup>({ status: 'idle' })
  const [receipt, setReceipt] = useState<ReceiptChange>({ kind: 'keep' })
  const [scan, setScan] = useState<ScanState>({ status: 'idle' })
  const [showSuggestions, setShowSuggestions] = useState(false)
  // A fresh id for a new expense: offline saves sync with it, exactly once.
  const [clientId] = useState(() => crypto.randomUUID())
  const amountId = useId()

  // Quick entry: your own past expenses here
  const suggestions = useMemo(() => (history ? buildSuggestions(history) : []), [history])
  const orderedCategories = useMemo(() => {
    const frequent = history ? frequentCategoryIds(history) : []
    const rank = (id: string) => (frequent.includes(id) ? frequent.indexOf(id) : frequent.length)
    return [...categories].sort((a, b) => rank(a.id) - rank(b.id))
  }, [categories, history])

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

  const matches = !expense && showSuggestions ? matchSuggestions(state.description, suggestions) : []

  function applySuggestion(suggestion: Suggestion) {
    setShowSuggestions(false)
    const knownCategory = categories.some((category) => category.id === suggestion.categoryId)
    update({
      description: suggestion.description,
      ...(knownCategory ? { categoryId: suggestion.categoryId } : {}),
      // Keep an amount you've already typed
      ...(state.amount.trim()
        ? {}
        : { amount: toDecimalString(toMinor(Number(suggestion.amount), suggestion.currency), suggestion.currency) }),
      ...(state.amount.trim() || suggestion.currency === state.currency ? {} : { currency: suggestion.currency }),
      paymentMethod: (suggestion.paymentMethod as PaymentMethod | null) ?? state.paymentMethod,
    })
  }

  async function scanReceipt(file: File) {
    setScan({ status: 'reading', progress: 0 })
    try {
      const { readReceipt } = await import('@/lib/receiptOcr')
      const guess = await readReceipt(file, (progress) => setScan({ status: 'reading', progress }))
      setScan(guess.amount || guess.date || guess.merchant ? { status: 'done', guess } : { status: 'failed' })
    } catch (error) {
      if (import.meta.env.DEV) console.error('[TripSplit] receipt scan', error)
      setScan({ status: 'failed' })
    }
  }

  function applyScan(guess: ReceiptGuess) {
    const changes: Partial<FormState> = {}
    if (guess.amount) {
      changes.amount = guess.amount
      changes.currency = state.currency
    }
    if (guess.merchant && !state.description.trim()) changes.description = guess.merchant
    update(changes)
    if (guess.date) changeDate(guess.date)
    setScan({ status: 'idle' })
  }

  const allSelected = selectedMembers.length === members.length
  // Only you in this budget or trip
  const shared = members.length > 1

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
    const draft = {
        id: expense?.id,
        clientId: expense ? undefined : clientId,
        tripId: trip.id,
        categoryId: state.categoryId,
        description: state.description.trim(),
        amount: toDecimalString(originalMinor, state.currency),
        currency: state.currency,
        exchangeRate: foreign ? rateText : '1',
        paidBy: state.paidBy,
        expenseDate: state.expenseDate || todayIso(),
        notes: state.notes,
        paymentMethod: state.paymentMethod || null,
        recurringId: expense ? null : (template?.recurringId ?? null),
        recurringMonth: expense ? null : (template?.recurringMonth ?? null),
        splits: calculation.splits.map((split) => ({
          userId: split.userId,
          splitType: state.method,
          value: split.value,
          amount: toDecimalString(split.amount, tripCurrency),
        })),
      }

    // No signal: keep it on this phone and sync it later (new expenses only).
    async function queue() {
      const photo = receipt.kind === 'replace' ? await prepareReceiptImage(receipt.file, RECEIPT_MAX_BYTES).catch(() => null) : null
      await queueExpense(currentUserId, { ...draft, clientId }, {
        tripName: trip.name,
        currency: tripCurrency,
        total: toDecimalString(totalMinor, tripCurrency),
      }, photo)
      if (foreign) exchangeRates.remember(state.currency, tripCurrency, rateText)
      onSaved(clientId, { receiptFailed: false, queued: true })
    }

    try {
      if (!expense && typeof navigator !== 'undefined' && navigator.onLine === false) return await queue()
      const id = await saveExpense(draft)
      if (foreign) exchangeRates.remember(state.currency, tripCurrency, rateText)
      onSaved(id, { receiptFailed: !(await saveReceipt(id)), queued: false })
    } catch (error) {
      if (!expense && isOfflineError(error)) {
        try {
          return await queue()
        } catch (queueError) {
          setFormError(getErrorMessage(queueError))
          setSaving(false)
          return
        }
      }
      setFormError(getErrorMessage(error))
      setSaving(false)
    }
  }

  const symbol = getCurrency(state.currency).symbol.trim()

  return (
    <form onSubmit={handleSubmit} noValidate className="min-h-dvh sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-surface sm:min-h-0 sm:rounded-3xl sm:shadow-sm sm:ring-1 sm:ring-slate-900/5">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-surface/95 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur sm:rounded-t-3xl sm:px-4">
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
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
              <span className="truncate">{trip.name}</span>
              {onChangeTrip && !expense && (
                <button
                  type="button"
                  onClick={onChangeTrip}
                  className="tap-target shrink-0 rounded font-semibold text-primary-600 hover:text-primary-700"
                >
                  Change
                </button>
              )}
            </p>
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
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-slate-500">
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
                    'h-16 w-full rounded-2xl border bg-surface pr-4 pl-14 text-3xl font-extrabold text-slate-900 tabular-nums placeholder:text-slate-300 focus:ring-4 focus:outline-none',
                    errors.amount
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500/15',
                  )}
                />
              </div>
              <select
                aria-label="Currency"
                value={state.currency}
                onChange={(event) => changeCurrency(event.target.value)}
                className="h-16 shrink-0 rounded-2xl border border-slate-300 bg-surface px-3 text-base font-bold text-slate-700 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 focus:outline-none"
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
                    className="h-11 w-32 rounded-lg border border-slate-300 bg-surface px-3 text-base font-semibold tabular-nums focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 focus:outline-none sm:text-sm"
                  />
                  <span>{tripCurrency}</span>
                </label>
                <p className="mt-2 text-sm text-slate-500">
                  ≈ <strong className="text-slate-900 tabular-nums">{formatMoney(totalMinor, tripCurrency)}</strong> in
                  the {trip.kind === 'budget' ? 'budget' : 'trip'} currency
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
                      className="rounded font-semibold text-primary-600 hover:text-primary-700"
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

          <div>
            <TextField
              label="Description"
              value={state.description}
              onChange={(event) => {
                update({ description: event.target.value })
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              error={errors.description}
              placeholder={trip.kind === 'budget' ? 'Groceries at Puregold' : 'Dinner at Lau Pa Sat'}
              maxLength={120}
              enterKeyHint="next"
              autoCapitalize="sentences"
              autoComplete="off"
            />
            {matches.length > 0 && (
              <div className="mt-2" aria-label="Suggestions from your past expenses" role="group">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <Sparkles className="size-3.5" aria-hidden />
                  {state.description.trim() ? 'Suggestions' : 'Your usual'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {matches.map((suggestion) => {
                    const category = categories.find((c) => c.id === suggestion.categoryId)
                    return (
                      <button
                        key={suggestion.description}
                        type="button"
                        onClick={() => applySuggestion(suggestion)}
                        className="flex min-h-11 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 sm:min-h-9"
                      >
                        {category && <span aria-hidden>{category.icon}</span>}
                        <span className="max-w-40 truncate">{suggestion.description}</span>
                        <span className="font-normal text-slate-500 tabular-nums">
                          {formatMoney(toMinor(Number(suggestion.amount), suggestion.currency), suggestion.currency)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <CategoryPicker
            categories={orderedCategories}
            value={state.categoryId}
            onChange={(categoryId) => update({ categoryId })}
            error={errors.category}
          />

          <div role="radiogroup" aria-label="Paid with">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Paid with <span className="font-normal text-slate-500">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const selected = state.paymentMethod === method
                return (
                  <button
                    key={method}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    // Tap again to clear
                    onClick={() => update({ paymentMethod: selected ? '' : method })}
                    className={cn(
                      'flex min-h-11 items-center gap-1 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors sm:min-h-9',
                      selected
                        ? 'bg-brand-600 text-white ring-primary-600'
                        : 'bg-surface text-slate-700 ring-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {selected && <Check className="size-3.5" aria-hidden />}
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* On your own there's nothing to choose: you paid, and it's all yours. */}
          {shared && (
            <MemberRadioChips
              label="Paid by"
              members={members}
              currentUserId={currentUserId}
              value={state.paidBy}
              onChange={(paidBy) => update({ paidBy })}
            />
          )}

          <section className="space-y-4" aria-label="Split" hidden={!shared}>
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
                    className="tap-target rounded-md px-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
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

          <div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                label="Date"
                type="date"
                value={state.expenseDate}
                max={todayIso()}
                onChange={(event) => changeDate(event.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-2">
              {[
                { label: 'Today', date: todayIso() },
                { label: 'Yesterday', date: dayBefore(todayIso()) },
              ].map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => changeDate(choice.date)}
                  aria-pressed={state.expenseDate === choice.date}
                  className={cn(
                    'min-h-11 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors sm:min-h-9',
                    state.expenseDate === choice.date
                      ? 'bg-brand-600 text-white ring-brand-600'
                      : 'bg-surface text-slate-700 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <ReceiptPicker
              existingPath={expense?.receipt_url ?? null}
              value={receipt}
              onChange={(change) => {
                setReceipt(change)
                setScan({ status: 'idle' })
              }}
            />
            {receipt.kind === 'replace' && scan.status === 'idle' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => scanReceipt(receipt.file)}
                icon={<ScanText className="size-4" aria-hidden />}
              >
                Read amount and date from photo
              </Button>
            )}
            <div aria-live="polite">
              {scan.status === 'reading' && (
                <p className="text-sm text-slate-600">
                  Reading the receipt on this device… {Math.round(scan.progress * 100)}%
                </p>
              )}
              {scan.status === 'failed' && (
                <p className="text-sm text-slate-600">
                  Couldn’t read this receipt clearly. Type the details instead — the photo is still attached.
                </p>
              )}
              {scan.status === 'done' && (
                <div className="rounded-2xl bg-primary-50 p-3 ring-1 ring-primary-100">
                  <p className="text-sm font-semibold text-slate-900">Found on the receipt</p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    {scan.guess.amount && (
                      <>
                        <dt className="text-slate-500">Total</dt>
                        <dd className="font-semibold tabular-nums">
                          {formatMoney(toMinor(Number(scan.guess.amount), state.currency), state.currency)}
                        </dd>
                      </>
                    )}
                    {scan.guess.date && (
                      <>
                        <dt className="text-slate-500">Date</dt>
                        <dd className="font-semibold">{formatDate(scan.guess.date)}</dd>
                      </>
                    )}
                    {scan.guess.merchant && (
                      <>
                        <dt className="text-slate-500">Shop</dt>
                        <dd className="truncate font-semibold">{scan.guess.merchant}</dd>
                      </>
                    )}
                  </dl>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => applyScan(scan.guess)} icon={<Check className="size-4" aria-hidden />}>
                      Use these
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setScan({ status: 'idle' })}>
                      Ignore
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

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
              className="tap-target rounded-md text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              + Add notes
            </button>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-slate-100 bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:rounded-b-3xl sm:px-6">
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
