import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { controlClasses } from '@/components/forms/controlStyles'
import { CURRENCIES, CURRENCY_CODES } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import { exchangeRates } from '@/services/exchangeRates'
import { changeTripCurrency } from '@/services/tripService'
import type { Trip } from '@/types/models'
import { convertMinor, formatMoney } from '@/utils/calculations/money'
import { formatDate } from '@/utils/format'

const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/

interface ChangeCurrencyFormProps {
  trip: Pick<Trip, 'id' | 'currency'>
  budgetMinor: number
  expenseCount: number
  onClose: () => void
  onChanged: (currency: string) => void
}

function ChangeCurrencyForm({ trip, budgetMinor, expenseCount, onClose, onChanged }: ChangeCurrencyFormProps) {
  const choices = CURRENCY_CODES.filter((code) => code !== trip.currency)
  const [target, setTarget] = useState<string>(choices[0])
  const [rate, setRate] = useState('')
  const [rateNote, setRateNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Look up the official rate whenever the target changes.
  useEffect(() => {
    let cancelled = false
    exchangeRates.getRate(trip.currency, target).then((quote) => {
      if (cancelled) return
      setRate(quote?.rate ?? '')
      setRateNote(
        quote?.source === 'ecb'
          ? `European Central Bank rate for ${formatDate(quote.date)}. You can change it.`
          : quote
            ? 'Live rates are unavailable — this is the rate you used last time.'
            : 'Live rates are unavailable — enter the rate yourself.',
      )
    })
    return () => {
      cancelled = true
    }
  }, [trip.currency, target])

  const rateValid = RATE_PATTERN.test(rate.trim()) && Number(rate) > 0
  const newBudget = rateValid ? convertMinor(budgetMinor, trip.currency, target, rate.trim()) : null

  async function confirm() {
    if (!rateValid) return setError(`Enter how many ${target} one ${trip.currency} is worth.`)
    setSaving(true)
    setError(null)
    try {
      await changeTripCurrency(trip.id, target, rate.trim())
      onChanged(target)
    } catch (caught) {
      setError(getErrorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">New currency</span>
        <select value={target} onChange={(event) => setTarget(event.target.value)} className={controlClasses(false)}>
          {choices.map((code) => (
            <option key={code} value={code}>
              {`${CURRENCIES[code].flag}  ${code} — ${CURRENCIES[code].name}`}
            </option>
          ))}
        </select>
      </label>

      <div>
        <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
          <span>1 {trip.currency} =</span>
          <input
            inputMode="decimal"
            value={rate}
            onChange={(event) => {
              setRate(event.target.value)
              setRateNote('Using your rate.')
            }}
            className="h-11 w-36 rounded-lg border border-slate-300 bg-surface px-3 text-base font-semibold tabular-nums focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none sm:text-sm"
            aria-label={`${target} per ${trip.currency}`}
          />
          <span>{target}</span>
        </label>
        {rateNote && <p className="mt-1.5 text-xs text-slate-500">{rateNote}</p>}
      </div>

      {budgetMinor > 0 && newBudget !== null && (
        <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
          Budget <strong>{formatMoney(budgetMinor, trip.currency)}</strong>
          <ArrowRight className="size-4 text-slate-400" aria-hidden />
          <strong>{formatMoney(newBudget, target)}</strong>
        </p>
      )}

      <Alert tone="warning" title="This converts everything">
        The budget, category budgets, settlements and everyone&apos;s shares of {expenseCount}{' '}
        {expenseCount === 1 ? 'expense' : 'expenses'} are converted at this rate. Each expense keeps its original
        amount and currency.
      </Alert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={confirm} loading={saving} disabled={!rateValid}>
          Convert to {target}
        </Button>
      </div>
    </div>
  )
}

interface ChangeCurrencyDialogProps extends ChangeCurrencyFormProps {
  open: boolean
}

export function ChangeCurrencyDialog({ open, ...props }: ChangeCurrencyDialogProps) {
  return (
    <Dialog open={open} onClose={props.onClose} title="Change currency" size="md">
      {open && <ChangeCurrencyForm key={props.trip.currency} {...props} />}
    </Dialog>
  )
}
