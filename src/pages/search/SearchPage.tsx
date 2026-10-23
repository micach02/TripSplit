import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronRight, Search, X } from 'lucide-react'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'
import { Highlight } from '@/components/search/Highlight'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { isOfflineError } from '@/lib/offlineCache'
import { tripPath } from '@/routes/paths'
import { SEARCH_LIMIT, searchExpenses, type ExpenseSearchResult } from '@/services/searchService'
import { listTripsOfflineFirst, type TripListItem } from '@/services/tripService'
import { formatAmount, formatMoney } from '@/utils/calculations/money'
import { coverEmoji, coverGradient } from '@/utils/coverStyle'
import { formatShortDate } from '@/utils/format'
import { addRecentSearch, matchesAll, searchTerms } from '@/utils/search'
import { timeframe } from '@/utils/tripKind'

const RECENT_KEY = 'tripsplit:recent-searches'
const EXAMPLES = ['dinner', 'groceries', 'Grab', '500']

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function storeRecent(list: string[]): void {
  try {
    if (list.length) window.localStorage.setItem(RECENT_KEY, JSON.stringify(list))
    else window.localStorage.removeItem(RECENT_KEY)
  } catch {
    // Private mode: recent searches are a convenience only.
  }
}

const chip = 'inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 sm:min-h-9'

function TripResult({ trip, terms, onOpen }: { trip: TripListItem; terms: string[]; onOpen: () => void }) {
  return (
    <li>
      <Link to={tripPath(trip.id)} onClick={onOpen} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5">
        <span
          aria-hidden
          className={cn('flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xl', coverGradient(trip.id))}
        >
          {coverEmoji(trip.kind)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">
            <Highlight text={trip.name} terms={terms} />
          </span>
          <span className="block truncate text-sm text-slate-500">
            {trip.destination && (
              <>
                <Highlight text={trip.destination} terms={terms} /> ·{' '}
              </>
            )}
            {timeframe({ kind: trip.kind, startDate: trip.start_date, endDate: trip.end_date })}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
      </Link>
    </li>
  )
}

function ExpenseResult({ expense, terms, onOpen }: { expense: ExpenseSearchResult; terms: string[]; onOpen: () => void }) {
  // Show the note only when it's (part of) why this expense matched.
  const note = expense.notes?.toLowerCase() ?? ''
  const noteMatches = terms.some((term) => note.includes(term))
  return (
    <li>
      <Link
        to={`${tripPath(expense.tripId, 'expenses')}?expense=${expense.id}`}
        onClick={onOpen}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5"
      >
        <CategoryIcon icon={expense.category?.icon ?? '📦'} color={expense.category?.color ?? '#64748b'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">
            <Highlight text={expense.description} terms={terms} />
          </span>
          <span className="block truncate text-sm text-slate-500">
            <Highlight text={expense.tripName} terms={terms} /> · {formatShortDate(expense.date)}
            {expense.paidByName && (
              <>
                {' · '}
                <Highlight text={expense.paidByName} terms={terms} /> paid
              </>
            )}
          </span>
          {noteMatches && expense.notes && (
            <span className="mt-0.5 block truncate text-sm text-slate-600 italic">
              <Highlight text={expense.notes} terms={terms} />
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-bold text-slate-900 tabular-nums">{formatMoney(expense.amountMinor, expense.tripCurrency)}</span>
          {expense.original && (
            <span className="block text-xs text-slate-500 tabular-nums">{formatAmount(expense.original.amount, expense.original.currency)}</span>
          )}
        </span>
      </Link>
    </li>
  )
}

/** One search box for everything: budgets and trips by name or place, expenses by anything about them. */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [text, setText] = useState(() => searchParams.get('q') ?? '')
  const [recent, setRecent] = useState(readRecent)
  const query = useDebouncedValue(text.trim(), 300)
  const terms = useMemo(() => searchTerms(query), [query])
  const ready = query.length >= 2

  const trips = useAsync(listTripsOfflineFirst)
  const load = useCallback(() => (ready ? searchExpenses(query) : Promise.resolve(null)), [ready, query])
  const expenses = useAsync(load)

  const tripMatches = ready && trips.data ? trips.data.filter((trip) => matchesAll([trip.name, trip.destination, trip.description], terms)) : []
  const expenseMatches = ready ? (expenses.data ?? null) : null
  const searching = ready && expenses.loading
  const offline = expenses.error ? isOfflineError(expenses.error) : false

  function change(value: string) {
    setText(value)
    // Keep the query in the address, so Back from a result comes back to it.
    setSearchParams(value.trim() ? { q: value.trim() } : {}, { replace: true })
  }

  function remember() {
    const next = addRecentSearch(recent, query)
    setRecent(next)
    storeRecent(next)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    remember()
    // Close the phone keyboard so the results are visible.
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const total = tripMatches.length + (expenseMatches?.length ?? 0)

  return (
    <>
      <PageTitle title={query ? `Search: ${query}` : 'Search'} />
      <PageHeader title="Search" description="Find any expense, budget or trip — by name, place, person, category or amount." />

      <form role="search" onSubmit={submit} className="relative">
        <label htmlFor="search-input" className="sr-only">
          Search expenses, budgets and trips
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          id="search-input"
          type="search"
          value={text}
          onChange={(event) => change(event.target.value)}
          placeholder="Try “seafood coron” or “500”"
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
          className="h-14 w-full rounded-full border border-slate-300 bg-surface pr-14 pl-13 text-base text-slate-900 shadow-card placeholder:text-slate-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={() => change('')}
            className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear search"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </form>

      <div className="mt-6 space-y-6">
        {!ready ? (
          <Card className="p-5 sm:p-6">
            {recent.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-slate-700">Recent searches</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setRecent([])
                      storeRecent([])
                    }}
                    className="tap-target rounded text-sm font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((item) => (
                    <button key={item} type="button" onClick={() => change(item)} className={chip}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <h2 className="text-sm font-bold text-slate-700">Try searching for</h2>
            <p className="mt-1 text-sm text-slate-500">
              A place, a person, a category or an amount. Use more words to narrow it down.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => change(example)} className={chip}>
                  {example}
                </button>
              ))}
            </div>
          </Card>
        ) : (
          <>
            {/* Announced when results settle, not on every keystroke */}
            <p className="sr-only" role="status">
              {searching ? 'Searching…' : `${total} ${total === 1 ? 'result' : 'results'} for ${query}`}
            </p>

            {tripMatches.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader title="Budgets & trips" description={`${tripMatches.length} found`} />
                <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                  {tripMatches.map((trip) => (
                    <TripResult key={trip.id} trip={trip} terms={terms} onOpen={remember} />
                  ))}
                </ul>
              </Card>
            )}

            {expenses.error && !expenseMatches ? (
              <Alert tone={offline ? 'info' : 'error'} title={offline ? 'Searching expenses needs a connection' : 'We couldn’t search your expenses'}>
                {offline ? 'Budgets and trips saved on this device are still searchable above.' : getErrorMessage(expenses.error)}
              </Alert>
            ) : expenseMatches === null || (searching && expenseMatches.length === 0) ? (
              <Card className="overflow-hidden">
                <ListSkeleton rows={4} label="Searching expenses…" />
              </Card>
            ) : expenseMatches.length > 0 ? (
              <Card className="overflow-hidden">
                <CardHeader
                  title="Expenses"
                  description={
                    expenseMatches.length >= SEARCH_LIMIT
                      ? `The ${SEARCH_LIMIT} newest matches — add a word to narrow it down`
                      : `${expenseMatches.length} found`
                  }
                />
                <ul className={cn('mt-4 divide-y divide-slate-100 border-t border-slate-100', searching && 'opacity-60')}>
                  {expenseMatches.map((expense) => (
                    <ExpenseResult key={expense.id} expense={expense} terms={terms} onOpen={remember} />
                  ))}
                </ul>
              </Card>
            ) : tripMatches.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Search}
                  emoji="🔎"
                  title={`No matches for “${query}”`}
                  description="Check the spelling, or try fewer or different words — a place, a person, a category or an amount."
                />
              </Card>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
