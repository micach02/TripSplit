import { useCallback, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
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
import { getExpense } from '@/services/expenseService'
import { TripNotFoundError } from '@/services/tripService'
import { canEditExpense } from '@/utils/permissions'

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>
}

/** /trips/:tripId/expenses/new and /trips/:tripId/expenses/:expenseId/edit */
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
            icon={SearchX}
            title="Trip not found"
            description="It may have been deleted, or you're not a member of it."
            action={<ButtonLink to={paths.trips}>Back to My Trips</ButtonLink>}
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
            Back to the trip
          </ButtonLink>
        </Alert>
      </Centered>
    )
  }

  if (!trip.data || (expenseId && expenseState.loading && !expense)) return <FullPageLoader />

  const details = trip.data
  const isOwner = details.trip.owner_id === user.id

  if (expenseId && !expense) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <EmptyState
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
      ? 'This trip is completed. Reopen it in Settings to add or change expenses.'
      : expense && !canEditExpense(expense, user.id, isOwner)
        ? 'Only the person who added or paid for this expense, or the trip owner, can change it.'
        : null

  if (blocked) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <EmptyState icon={Lock} title="Can’t edit here" description={blocked} action={<ButtonLink to={backToTrip}>Back to expenses</ButtonLink>} />
        </Card>
      </Centered>
    )
  }

  return (
    <>
      <PageTitle title={expense ? `Edit ${expense.description}` : `Add expense · ${details.trip.name}`} />
      <ExpenseForm
        trip={details.trip}
        members={details.members}
        categories={details.categories}
        currentUserId={user.id}
        expense={expense ?? undefined}
        onSaved={(_id, { receiptFailed }) => {
          if (receiptFailed) {
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
