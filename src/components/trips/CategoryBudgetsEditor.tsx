import { useCallback, useState, type FormEvent } from 'react'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'
import { getCurrency } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import { listCategoryBudgets, saveCategoryBudget, type CategoryBudget } from '@/services/budgetService'
import type { Category, Trip } from '@/types/models'
import { formatMoney, parseMoneyInput, toDecimalString } from '@/utils/calculations/money'

interface EditorProps {
  trip: Pick<Trip, 'id' | 'currency'>
  categories: Category[]
  budgetMinor: number
  /** Everyday budgets: the limits are per month */
  monthly: boolean
  existing: CategoryBudget[]
  onSaved: () => void
}

function Editor({ trip, categories, budgetMinor, monthly, existing, onSaved }: EditorProps) {
  const toast = useToast()
  const byCategory = new Map(existing.map((budget) => [budget.categoryId, budget]))
  const initial = Object.fromEntries(
    categories.map((category) => {
      const budget = byCategory.get(category.id)
      return [category.id, budget ? toDecimalString(budget.planned, trip.currency) : '']
    }),
  )
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const symbol = getCurrency(trip.currency).symbol.trim()

  const parsed = Object.fromEntries(
    categories.map((category) => {
      const text = values[category.id]?.trim() ?? ''
      return [category.id, text ? parseMoneyInput(text, trip.currency) : null]
    }),
  )
  const invalid = categories.filter((category) => parsed[category.id] && !parsed[category.id]!.ok)
  const plannedTotal = categories.reduce((sum, category) => {
    const result = parsed[category.id]
    return result?.ok ? sum + result.minor : sum
  }, 0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (invalid.length > 0) return setError('Fix the highlighted amounts first.')
    setSaving(true)
    setError(null)
    try {
      for (const category of categories) {
        const result = parsed[category.id]
        const next = result?.ok && result.minor > 0 ? toDecimalString(result.minor, trip.currency) : ''
        const before = byCategory.get(category.id)
        const unchanged = before ? toDecimalString(before.planned, trip.currency) === next : next === ''
        if (!unchanged) await saveCategoryBudget(trip.id, category.id, next, before?.id ?? null)
      }
      toast.success('Category budgets saved.')
      onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {categories.map((category) => {
          const bad = parsed[category.id] && !parsed[category.id]!.ok
          return (
            <li key={category.id}>
              <label className="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-primary-500">
                <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{category.name}</span>
                <span className="text-sm text-slate-500">{symbol}</span>
                <input
                  inputMode="decimal"
                  value={values[category.id] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [category.id]: event.target.value }))}
                  placeholder="—"
                  aria-invalid={bad ? true : undefined}
                  aria-label={`Planned budget for ${category.name}`}
                  className={cn(
                    'h-11 w-28 rounded-lg border px-2 text-right sm:h-10 text-base font-semibold tabular-nums focus:outline-none sm:text-sm',
                    bad ? 'border-red-400 text-red-700' : 'border-transparent bg-slate-50',
                  )}
                />
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={cn('text-sm', budgetMinor > 0 && plannedTotal > budgetMinor ? 'font-semibold text-orange-700' : 'text-slate-500')}>
          Planned {formatMoney(plannedTotal, trip.currency)}
          {budgetMinor > 0 && ` of the ${formatMoney(budgetMinor, trip.currency)} ${monthly ? 'monthly' : 'trip'} budget`}
          {budgetMinor > 0 && plannedTotal > budgetMinor && ` — more than the ${monthly ? 'monthly' : 'trip'} budget`}
        </p>
        <Button type="submit" loading={saving}>
          Save category budgets
        </Button>
      </div>
    </form>
  )
}

/** Owner tool: planned amount per category, compared with actual spend in Analytics. */
export function CategoryBudgetsEditor({
  trip,
  categories,
  budgetMinor,
  monthly = false,
}: {
  trip: Pick<Trip, 'id' | 'currency'>
  categories: Category[]
  budgetMinor: number
  monthly?: boolean
}) {
  const load = useCallback(() => listCategoryBudgets(trip.id, trip.currency), [trip.id, trip.currency])
  const { data, error, reload } = useAsync(load)

  if (error && !data) return <Alert tone="error">{getErrorMessage(error)}</Alert>
  if (!data) {
    return (
      <div className="flex justify-center py-6 text-primary-600">
        <Spinner />
      </div>
    )
  }
  // Remount with fresh values after each save or currency change.
  return (
    <Editor
      key={`${trip.currency}:${data.map((b) => `${b.categoryId}=${b.planned}`).join(',')}`}
      trip={trip}
      categories={categories}
      budgetMinor={budgetMinor}
      monthly={monthly}
      existing={data}
      onSaved={reload}
    />
  )
}
