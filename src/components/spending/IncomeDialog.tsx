import { useState, type FormEvent } from 'react'
import { CurrencySelect } from '@/components/forms/CurrencySelect'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { TextField } from '@/components/forms/TextField'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { getErrorMessage } from '@/lib/errors'
import { createIncome, deleteIncome, updateIncome } from '@/services/incomeService'
import type { Income } from '@/types/models'
import { parseMoneyInput, toDecimalString, toMinor } from '@/utils/calculations/money'
import { todayIso } from '@/utils/tripStatus'

const SOURCES = ['Salary', 'Freelance', 'Business', 'Allowance', 'Bonus', 'Gift', 'Refund']

interface IncomeDialogProps {
  open: boolean
  existing: Income | null
  defaultCurrency: string
  onClose: () => void
  onSaved: (message: string) => void
}

function Form({ existing, defaultCurrency, onClose, onSaved }: Omit<IncomeDialogProps, 'open'>) {
  const [amount, setAmount] = useState(existing ? toDecimalString(toMinor(existing.amount, existing.currency), existing.currency) : '')
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency)
  const [receivedOn, setReceivedOn] = useState(existing?.received_on ?? todayIso())
  const [source, setSource] = useState(existing?.source ?? '')
  const [errors, setErrors] = useState<{ amount?: string; source?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const parsed = parseMoneyInput(amount, currency)
    const found = {
      amount: !parsed.ok ? parsed.error : parsed.minor <= 0 ? 'The amount must be more than zero.' : undefined,
      source: source.trim() ? undefined : 'Where is it from? e.g. Salary.',
    }
    setErrors(found)
    if (found.amount || found.source || !parsed.ok) return focusFirstInvalid(form)
    setBusy('save')
    setFormError(null)
    try {
      const input = { amount: toDecimalString(parsed.minor, currency), currency, receivedOn, source, notes: '' }
      if (existing) await updateIncome(existing.id, input)
      else await createIncome(input)
      onSaved(existing ? 'Income updated.' : 'Income added.')
    } catch (error) {
      setFormError(getErrorMessage(error))
      setBusy(null)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setBusy('delete')
    try {
      await deleteIncome(existing.id)
      onSaved('Income deleted.')
    } catch (error) {
      setFormError(getErrorMessage(error))
      setBusy(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={errors.amount}
          placeholder="0.00"
        />
        <CurrencySelect label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} />
      </div>
      <div>
        <TextField
          label="From"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          error={errors.source}
          placeholder="e.g. Salary"
          maxLength={80}
          list="income-sources"
          autoCapitalize="words"
        />
        <datalist id="income-sources">
          {SOURCES.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
      <TextField label="Received on" type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
      <p className="text-xs text-slate-500">Only you can see your income — it’s never shared with anyone in your budgets or trips.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {existing ? (
          <Button variant="ghost" onClick={handleDelete} loading={busy === 'delete'} disabled={busy !== null}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={busy !== null}>
            Cancel
          </Button>
          <Button type="submit" loading={busy === 'save'} disabled={busy !== null}>
            {existing ? 'Save' : 'Add income'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Add or edit an income entry (private to you). */
export function IncomeDialog({ open, existing, defaultCurrency, onClose, onSaved }: IncomeDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={existing ? 'Edit income' : 'Add income'}>
      {open && <Form key={existing?.id ?? 'new'} existing={existing} defaultCurrency={defaultCurrency} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}
