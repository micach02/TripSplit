import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { CurrencySelect } from '@/components/forms/CurrencySelect'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { TextareaField } from '@/components/forms/TextareaField'
import { TextField } from '@/components/forms/TextField'
import { TripCover } from '@/components/trips/TripCover'
import type { CoverChange, TripFormValues } from '@/components/trips/tripFormValues'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { getCurrency } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import type { TripInput } from '@/services/tripService'
import { parseMoneyInput, toDecimalString } from '@/utils/calculations/money'
import { currentMonth, monthPeriod } from '@/utils/budgetPeriod'
import { checkImageFile, IMAGE_ACCEPT } from '@/utils/image'
import { collectErrors, type FieldErrors } from '@/utils/validation'

interface TripFormProps {
  tripId?: string
  initial: TripFormValues
  coverUrl?: string | null
  /** The currency can't change once money has been recorded. */
  currencyLocked?: boolean
  submitLabel: string
  onSubmit: (input: TripInput, cover: CoverChange) => Promise<void>
  onCancel?: () => void
}

type Field = 'name' | 'startDate' | 'endDate' | 'budget'

const MAX_COVER_BYTES = 15 * 1024 * 1024

export function TripForm({ tripId, initial, coverUrl = null, currencyLocked = false, submitLabel, onSubmit, onCancel }: TripFormProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cover, setCover] = useState<CoverChange>({ kind: 'keep' })
  const [preview, setPreview] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Release the object URL of the previous preview.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const set = <K extends keyof TripFormValues>(key: K) => (value: TripFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  const symbol = getCurrency(values.currency).symbol
  const budgetKind = values.kind === 'budget'
  const noun = budgetKind ? 'budget' : 'trip'
  const shownCover = cover.kind === 'replace' ? preview : cover.kind === 'remove' ? null : coverUrl

  async function pickCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = await checkImageFile(file, MAX_COVER_BYTES)
    if (problem) {
      setFormError(problem)
      return
    }
    setFormError(null)
    setCover({ kind: 'replace', file })
    setPreview(URL.createObjectURL(file))
  }

  function removeCover() {
    setCover(coverUrl ? { kind: 'remove' } : { kind: 'keep' })
    setPreview(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const budgetText = values.budget.trim()
    const budget = budgetText ? parseMoneyInput(budgetText, values.currency) : ({ ok: true, minor: 0 } as const)

    const found = collectErrors<Field>({
      name: !values.name.trim()
        ? `Give your ${noun} a name.`
        : values.name.trim().length > 100
          ? 'Keep the name under 100 characters.'
          : null,
      // Budgets have no dates to pick: they start this month and keep going.
      startDate: budgetKind || values.startDate ? null : 'Choose a start date.',
      endDate: budgetKind
        ? null
        : !values.endDate
          ? 'Choose an end date.'
          : values.startDate && values.endDate < values.startDate
            ? 'The trip can’t end before it starts.'
            : null,
      budget: budget.ok ? null : budget.error,
    })
    setErrors(found ?? {})
    setFormError(null)
    if (found || !budget.ok) return focusFirstInvalid(form)

    setSubmitting(true)
    try {
      await onSubmit(
        {
          kind: values.kind,
          name: values.name,
          destination: budgetKind ? null : values.destination,
          description: values.description,
          startDate: values.startDate || monthPeriod(currentMonth()).start,
          endDate: budgetKind ? null : values.endDate,
          rollover: budgetKind && values.rollover,
          budget: toDecimalString(budget.minor, values.currency),
          currency: values.currency,
        },
        cover,
      )
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert tone="error">{formError}</Alert>}

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Cover photo</span>
        <div className="relative overflow-hidden rounded-2xl">
          <TripCover tripId={tripId ?? (values.name || 'new-trip')} name={values.name} url={shownCover} className="h-36 sm:h-44" />
          <div className="absolute right-3 bottom-3 flex gap-2">
            {shownCover && (
              <Button variant="outline" size="sm" onClick={removeCover} icon={<Trash2 className="size-4" aria-hidden />}>
                Remove
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
              icon={<ImagePlus className="size-4" aria-hidden />}
            >
              {shownCover ? 'Change' : 'Add photo'}
            </Button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={pickCover}
        />
      </div>

      <TextField
        label={budgetKind ? 'Budget name' : 'Trip name'}
        value={values.name}
        onChange={(event) => set('name')(event.target.value)}
        error={errors.name}
        placeholder={budgetKind ? 'Groceries & Food' : 'Singapore Adventure'}
        maxLength={100}
        autoCapitalize="words"
      />

      {!budgetKind && (
        <>
          <TextField
            label="Destination"
            value={values.destination}
            onChange={(event) => set('destination')(event.target.value)}
            placeholder="Singapore"
            maxLength={120}
            autoCapitalize="words"
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label="Start date"
              type="date"
              value={values.startDate}
              onChange={(event) => set('startDate')(event.target.value)}
              error={errors.startDate}
            />
            <TextField
              label="End date"
              type="date"
              value={values.endDate}
              min={values.startDate || undefined}
              onChange={(event) => set('endDate')(event.target.value)}
              error={errors.endDate}
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          label={`${budgetKind ? 'Monthly budget' : 'Budget'} (${symbol.trim()})`}
          inputMode="decimal"
          value={values.budget}
          onChange={(event) => set('budget')(event.target.value)}
          error={errors.budget}
          placeholder={budgetKind ? '12,000' : '50,000'}
          hint={
            budgetKind
              ? 'How much to spend each month. Every month starts fresh.'
              : 'Optional — leave empty to skip budget tracking.'
          }
        />
        <CurrencySelect
          label={budgetKind ? 'Currency' : 'Trip currency'}
          value={values.currency}
          onChange={(event) => set('currency')(event.target.value)}
          disabled={currencyLocked}
          hint={
            currencyLocked
              ? `Money is already recorded in it — use “Change currency” below to convert the whole ${noun}.`
              : 'Balances and the budget are tracked in this currency.'
          }
        />
      </div>

      {budgetKind && (
        <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <input
            type="checkbox"
            checked={values.rollover}
            onChange={(event) => set('rollover')(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800">Roll over what’s left</span>
            <span className="block text-sm text-slate-500">
              Unspent money adds to next month’s budget — and overspending takes from it.
            </span>
          </span>
        </label>
      )}

      <TextareaField
        label="Description"
        value={values.description}
        onChange={(event) => set('description')(event.target.value)}
        placeholder={
          budgetKind
            ? 'Weekly market runs, eating out and deliveries for the household.'
            : 'Hawker centres, Universal Studios and Gardens by the Bay.'
        }
        maxLength={2000}
        rows={3}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
