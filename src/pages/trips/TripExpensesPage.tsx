import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, ReceiptText, Search, SlidersHorizontal, X } from 'lucide-react'
import { ExpenseDetailsDialog } from '@/components/expenses/ExpenseDetailsDialog'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { OutboxList } from '@/components/expenses/OutboxList'
import type { ExpenseRowContext } from '@/components/expenses/ExpenseRow'
import { controlClasses } from '@/components/forms/controlStyles'
import { SelectField } from '@/components/forms/SelectField'
import { TextField } from '@/components/forms/TextField'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { memberName, useTripContext, type TripContextValue } from '@/hooks/useTripContext'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'
import { useDataChanged } from '@/lib/dataEvents'
import { getErrorMessage } from '@/lib/errors'
import { newExpensePath } from '@/routes/paths'
import {
  EMPTY_EXPENSE_FILTERS,
  listAllExpenses,
  listExpenses,
  type ExpenseFilters,
  type ExpenseSort,
  type ExpenseWithSplits,
} from '@/services/expenseService'
import { parseMoneyInput, toDecimalString, toMinor } from '@/utils/calculations/money'
import { downloadCsv, slugify, toCsv } from '@/utils/csv'
import { paymentMethodLabel } from '@/utils/paymentMethods'

type PanelFilters = Omit<ExpenseFilters, 'search' | 'minAmount' | 'maxAmount'>

const SORT_LABELS: Record<ExpenseSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  highest: 'Highest amount',
  lowest: 'Lowest amount',
}

/** A valid amount as a decimal string, '' when empty, null when invalid. */
function amountFilter(text: string, currency: string): string | null {
  if (!text.trim()) return ''
  const parsed = parseMoneyInput(text, currency)
  return parsed.ok ? toDecimalString(parsed.minor, currency) : null
}

function ExpenseResults({
  tripId,
  filters,
  context,
  filtered,
  canAdd,
  onSelect,
  onClearFilters,
}: {
  tripId: string
  filters: ExpenseFilters
  context: ExpenseRowContext
  filtered: boolean
  canAdd: boolean
  onSelect: (expense: ExpenseWithSplits) => void
  onClearFilters: () => void
}) {
  const toast = useToast()
  const [result, setResult] = useState<{ items: ExpenseWithSplits[]; total: number } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    listExpenses(tripId, filters, 0).then(
      (page) => {
        if (!cancelled) setResult(page)
      },
      (caught: unknown) => {
        if (!cancelled) setError(caught)
      },
    )
    return () => {
      cancelled = true
    }
  }, [tripId, filters])

  async function loadMore() {
    if (!result) return
    setLoadingMore(true)
    try {
      const page = await listExpenses(tripId, filters, result.items.length)
      setResult((current) => ({ items: [...(current?.items ?? []), ...page.items], total: page.total }))
    } catch (caught) {
      toast.error(getErrorMessage(caught))
    } finally {
      setLoadingMore(false)
    }
  }

  if (error) {
    return (
      <div className="p-5">
        <Alert tone="error" title="We couldn't load expenses">
          {getErrorMessage(error)}
        </Alert>
      </div>
    )
  }

  if (!result) return <ListSkeleton rows={6} label="Loading expenses…" />

  if (result.items.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Search}
        title="No matching expenses"
        description="Try a different search or clear the filters."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={ReceiptText}
        title="No expenses yet."
        description="Start tracking your trip expenses."
        action={
          canAdd && (
            <ButtonLink to={newExpensePath(tripId)} icon={<Plus className="size-5" aria-hidden />}>
              Add Expense
            </ButtonLink>
          )
        }
      />
    )
  }

  const hasMore = result.items.length < result.total
  return (
    <>
      <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500 sm:px-5" aria-live="polite">
        {result.total === 1 ? '1 expense' : `${result.total} expenses`}
        {filtered && ' match'}
      </p>
      <ExpenseList
        expenses={result.items}
        context={context}
        onSelect={onSelect}
        groupByDate={filters.sort === 'newest' || filters.sort === 'oldest'}
      />
      {hasMore && (
        <div className="border-t border-slate-100 p-4 text-center">
          <Button variant="outline" onClick={loadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </>
  )
}

function FiltersPanel({
  context,
  value,
  onChange,
  minText,
  maxText,
  onMinChange,
  onMaxChange,
  minError,
  maxError,
}: {
  context: TripContextValue
  value: PanelFilters
  onChange: (value: PanelFilters) => void
  minText: string
  maxText: string
  onMinChange: (text: string) => void
  onMaxChange: (text: string) => void
  minError: string | null
  maxError: string | null
}) {
  const set = <K extends keyof PanelFilters>(key: K, next: PanelFilters[K]) => onChange({ ...value, [key]: next })
  return (
    <div className="animate-fade-in grid grid-cols-1 gap-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-slate-900/5 sm:grid-cols-2 lg:grid-cols-3">
      <SelectField label="Category" value={value.categoryId} onChange={(event) => set('categoryId', event.target.value)}>
        <option value="">All categories</option>
        {context.categories.map((category) => (
          <option key={category.id} value={category.id}>
            {`${category.icon}  ${category.name}`}
          </option>
        ))}
      </SelectField>
      <SelectField label="Paid by" value={value.paidBy} onChange={(event) => set('paidBy', event.target.value)}>
        <option value="">Anyone</option>
        {context.members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {memberName(context, member.userId, { you: true })}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Involving"
        hint="Paid for it or shares it"
        value={value.involving}
        onChange={(event) => set('involving', event.target.value)}
      >
        <option value="">Anyone</option>
        {context.members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {memberName(context, member.userId, { you: true })}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="From" type="date" value={value.dateFrom} onChange={(event) => set('dateFrom', event.target.value)} />
        <TextField
          label="To"
          type="date"
          value={value.dateTo}
          min={value.dateFrom || undefined}
          onChange={(event) => set('dateTo', event.target.value)}
        />
      </div>
      <SelectField label="Sort" value={value.sort} onChange={(event) => set('sort', event.target.value as ExpenseSort)}>
        {(Object.keys(SORT_LABELS) as ExpenseSort[]).map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Min amount"
          inputMode="decimal"
          value={minText}
          onChange={(event) => onMinChange(event.target.value)}
          error={minError}
          placeholder="0"
        />
        <TextField
          label="Max amount"
          inputMode="decimal"
          value={maxText}
          onChange={(event) => onMaxChange(event.target.value)}
          error={maxError}
          placeholder="Any"
        />
      </div>
    </div>
  )
}

const EMPTY_PANEL: PanelFilters = {
  categoryId: EMPTY_EXPENSE_FILTERS.categoryId,
  paidBy: EMPTY_EXPENSE_FILTERS.paidBy,
  involving: EMPTY_EXPENSE_FILTERS.involving,
  dateFrom: EMPTY_EXPENSE_FILTERS.dateFrom,
  dateTo: EMPTY_EXPENSE_FILTERS.dateTo,
  sort: EMPTY_EXPENSE_FILTERS.sort,
}

export default function TripExpensesPage() {
  const context = useTripContext()
  const { trip, effectiveStatus, reload, period } = context
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const [panel, setPanel] = useState<PanelFilters>(EMPTY_PANEL)
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<ExpenseWithSplits | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  useDataChanged(() => setRefreshKey((key) => key + 1))

  const minAmount = amountFilter(minText, trip.currency)
  const maxAmount = amountFilter(maxText, trip.currency)

  // Budgets show the month picked at the top, unless you choose your own dates.
  const customDates = Boolean(panel.dateFrom || panel.dateTo)
  const periodStart = period?.start ?? ''
  const periodEnd = period?.end ?? ''
  const filters = useMemo<ExpenseFilters>(
    () => ({
      ...panel,
      dateFrom: customDates ? panel.dateFrom : periodStart,
      dateTo: customDates ? panel.dateTo : periodEnd,
      search: debouncedSearch,
      minAmount: minAmount ?? '',
      maxAmount: maxAmount ?? '',
    }),
    [panel, customDates, periodStart, periodEnd, debouncedSearch, minAmount, maxAmount],
  )

  const activeCount =
    [panel.categoryId, panel.paidBy, panel.involving, panel.dateFrom, panel.dateTo, filters.minAmount, filters.maxAmount].filter(Boolean)
      .length + (panel.sort !== 'newest' ? 1 : 0)
  const filtered = activeCount > 0 || Boolean(debouncedSearch)
  const canAdd = effectiveStatus !== 'completed'

  /** Everything matching the current search and filters, oldest first, with each person's share. */
  async function exportCsv() {
    setExporting(true)
    try {
      const expenses = await listAllExpenses(trip.id, filters)
      if (expenses.length === 0) {
        toast.show('Nothing to export: no expenses match.')
        return
      }
      const people = context.members.length > 1 ? context.members : []
      const decimal = (amount: number, currency: string) => toDecimalString(toMinor(amount, currency), currency)
      const rows = [
        [
          'Date',
          'Description',
          'Category',
          'Paid by',
          'Paid with',
          'Amount',
          'Currency',
          `Amount (${trip.currency})`,
          ...people.map((member) => `${memberName(context, member.userId)}'s share (${trip.currency})`),
          'Notes',
        ],
        ...expenses.map((expense) => [
          expense.expense_date,
          expense.description,
          context.categoryById.get(expense.category_id)?.name ?? '',
          memberName(context, expense.paid_by),
          paymentMethodLabel(expense.payment_method),
          decimal(expense.amount, expense.currency),
          expense.currency,
          decimal(expense.converted_amount, trip.currency),
          ...people.map((member) => {
            const split = expense.expense_splits.find((entry) => entry.user_id === member.userId)
            return split ? decimal(split.amount, trip.currency) : ''
          }),
          expense.notes ?? '',
        ]),
      ]
      const when = period && !customDates ? `-${slugify(period.label)}` : ''
      downloadCsv(`${slugify(trip.name)}${when}-expenses.csv`, toCsv(rows))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  function clearAll() {
    setSearch('')
    setPanel(EMPTY_PANEL)
    setMinText('')
    setMaxText('')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search expenses</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search expenses"
            className={controlClasses(false, 'pl-11')}
          />
        </label>
        <Button
          variant={showFilters || activeCount > 0 ? 'secondary' : 'outline'}
          onClick={() => setShowFilters((value) => !value)}
          aria-expanded={showFilters}
          // Phones show only the icon, so the button needs its name spelled out.
          aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
          icon={<SlidersHorizontal className="size-4" aria-hidden />}
          className="h-12 sm:h-11"
        >
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white">
              {activeCount}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={exportCsv}
          loading={exporting}
          aria-label="Export CSV"
          title="Download these expenses as a spreadsheet (CSV)"
          icon={<Download className="size-4" aria-hidden />}
          className="h-12 sm:h-11"
        >
          <span className="hidden lg:inline">Export CSV</span>
        </Button>
        {canAdd && (
          <ButtonLink
            to={newExpensePath(trip.id)}
            className="h-11 max-sm:hidden"
            icon={<Plus className="size-5" aria-hidden />}
          >
            Add expense
          </ButtonLink>
        )}
      </div>

      {showFilters && (
        <FiltersPanel
          context={context}
          value={panel}
          onChange={setPanel}
          minText={minText}
          maxText={maxText}
          onMinChange={setMinText}
          onMaxChange={setMaxText}
          minError={minAmount === null ? 'Enter a valid amount.' : null}
          maxError={maxAmount === null ? 'Enter a valid amount.' : null}
        />
      )}

      {filtered && (
        <button
          type="button"
          onClick={clearAll}
          className={cn('inline-flex items-center gap-1 rounded-md text-sm font-semibold text-blue-600 hover:text-blue-700')}
        >
          <X className="size-4" aria-hidden />
          Clear search and filters
        </button>
      )}

      <OutboxList tripId={trip.id} format={(minor) => context.money.format(minor)} />

      {period && !customDates && (
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{period.label}</span>. Switch months at the top, or pick
          dates in Filters.
        </p>
      )}

      <Card className="overflow-hidden">
        {/* Outline for screen readers: trip name (h1) → this → each day (h3) */}
        <h2 className="sr-only">Expenses</h2>
        <ExpenseResults
          key={`${JSON.stringify(filters)}:${refreshKey}`}
          tripId={trip.id}
          filters={filters}
          context={context}
          filtered={filtered}
          canAdd={canAdd}
          onSelect={setSelected}
          onClearFilters={clearAll}
        />
      </Card>

      <ExpenseDetailsDialog
        expense={selected}
        context={context}
        onClose={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null)
          toast.success('Expense deleted.')
          setRefreshKey((key) => key + 1)
          reload()
        }}
      />
    </div>
  )
}
