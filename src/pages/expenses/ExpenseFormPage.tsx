import { useCallback, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Lock, SearchX } from 'lucide-react'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { PageTitle } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useCurrentUser } from '@/hooks/useAuth'
import { useTripData } from '@/hooks/useTripData'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { paths, tripPath } from '@/routes/paths'
import { getExpense, listMyRecentExpenses } from '@/services/expenseService'
import { listRecurring } from '@/services/recurringService'
import { TripNotFoundError } from '@/services/tripService'
import { parseMonth } from '@/utils/budgetPeriod'
import { templateFromExpense, templateFromRecurring } from '@/utils/expenseTemplates'
import { canEditExpense } from '@/utils/permissions'

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>
}

/**
 * /trips/:tripId/expenses/new and /trips/:tripId/expenses/:expenseId/edit
 *
 * New expenses can start from a template: ?from=<expense id> ("Add again") or
 * ?recurring=<id>&month=yyyy-MM (a recurring reminder).
 */
export default function ExpenseFormPage() {
  const { tripId = '', expenseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { user } = useCurrentUser()
  const trip = useTripData(tripId)
  const loadExpense = useCallback(() => (expenseId ? getExpense(expenseId) : Promise.resolve(null)), [expenseId])
  const expenseState = useAsync(loadExpense)
  const expense = expenseId && expenseState.data?.id === expenseId ? expenseState.data : null

  // Templates for new expenses
  const [searchParams] = useSearchParams()
  const fromId = expenseId ? null : searchParams.get('from')
  const recurringId = expenseId ? null : searchParams.get('recurring')
  const recurringMonth = parseMonth(searchParams.get('month'))
  const loadSource = useCallback(async () => {
    if (fromId) return { expense: await getExpense(fromId), recurring: null }
    if (recurringId) return { expense: null, recurring: (await listRecurring(tripId)).find((r) => r.id === recurringId) ?? null }
    return { expense: null, recurring: null }
  }, [fromId, recurringId, tripId])
  const source = useAsync(loadSource)

  // Your past expenses here, for suggestions (best effort: none offline)
  const loadHistory = useCallback(() => listMyRecentExpenses(tripId, user.id).catch(() => []), [tripId, user.id])
  const history = useAsync(loadHistory)

  const template = useMemo(() => {
    const currency = trip.data?.trip.currency
    if (!currency || !source.data) return undefined
    if (source.data.expense && source.data.expense.trip_id === tripId) return templateFromExpense(source.data.expense, currency)
    if (source.data.recurring && recurringMonth) return templateFromRecurring(source.data.recurring, { currency }, recurringMonth)
    return undefined
  }, [trip.data?.trip.currency, source.data, tripId, recurringMonth])
  const quickAdd = Boolean((location.state as { quickAdd?: boolean } | null)?.quickAdd)

  const backToTrip = tripPath(tripId, 'expenses')
  function close() {
    // Go back if we came from inside the app; otherwise to the trip's expenses.
    if (location.key !== 'default') navigate(-1)
    else navigate(backToTrip, { replace: true })
  }

  if (trip.error instanceof TripNotFoundError) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <EmptyState
            headingLevel={1}
            icon={SearchX}
            title="We couldn’t find that"
            description="This trip or budget may have been deleted, or you’re not a member of it."
            action={<ButtonLink to={paths.trips}>Back to Budgets & Trips</ButtonLink>}
          />
        </Card>
      </Centered>
    )
  }

  const loadError = (trip.error && !trip.data) || (expenseId && expenseState.error)
  if (loadError) {
    return (
      <Centered>
        <Alert tone="error" title="We couldn't open this expense" className="w-full max-w-md">
          <p>{getErrorMessage(trip.error ?? expenseState.error)}</p>
          <ButtonLink to={backToTrip} variant="outline" size="sm" className="mt-3">
            Back to expenses
          </ButtonLink>
        </Alert>
      </Centered>
    )
  }

  const waitingForTemplate = (fromId || recurringId) && source.loading && !source.data
  if (!trip.data || (expenseId && expenseState.loading && !expense) || waitingForTemplate) return <FullPageLoader />

  const details = trip.data
  const isOwner = details.trip.owner_id === user.id

  if (expenseId && !expense) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <EmptyState
            headingLevel={1}
            icon={SearchX}
            title="Expense not found"
            description="It may have been deleted."
            action={<ButtonLink to={backToTrip}>Back to expenses</ButtonLink>}
          />
        </Card>
      </Centered>
    )
  }

  const blocked =
    details.effectiveStatus === 'completed'
      ? details.trip.kind === 'budget'
        ? 'This budget is archived. Reopen it in Settings to add or change expenses.'
        : 'This trip is completed. Reopen it in Settings to add or change expenses.'
      : expense && !canEditExpense(expense, user.id, isOwner)
        ? `Only the person who added or paid for this expense, or the ${details.trip.kind === 'budget' ? 'budget' : 'trip'} owner, can change it.`
        : null

  if (blocked) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <EmptyState icon={Lock} headingLevel={1} title="Can’t edit here" description={blocked} action={<ButtonLink to={backToTrip}>Back to expenses</ButtonLink>} />
        </Card>
      </Centered>
    )
  }

  return (
    <>
      <PageTitle title={expense ? `Edit ${expense.description}` : `Add expense · ${details.trip.name}`} />
      <ExpenseForm
        // A different template means a fresh form
        key={template ? `${fromId ?? ''}${recurringId ?? ''}${recurringMonth ?? ''}` : 'blank'}
        template={template}
        history={history.data}
        onChangeTrip={quickAdd ? () => navigate('/expenses/new?choose=1') : undefined}
        trip={details.trip}
        members={details.members}
        categories={details.categories}
        currentUserId={user.id}
        expense={expense ?? undefined}
        onSaved={(_id, { receiptFailed, queued }) => {
          if (queued) {
            toast.success('Saved on this phone. It will sync when you’re back online.')
          } else if (receiptFailed) {
            toast.error(
              `${expense ? 'Expense updated' : 'Expense added'}, but the receipt couldn’t be saved. Edit the expense to try again.`,
            )
          } else {
            toast.success(expense ? 'Expense updated.' : 'Expense added.')
          }
          navigate(backToTrip, { replace: true })
        }}
        onCancel={close}
      />
    </>
  )
}
