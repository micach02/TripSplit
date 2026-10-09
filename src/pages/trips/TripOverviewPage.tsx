import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { CalendarRange, Plus, ReceiptText, UserPlus, Users } from 'lucide-react'
import { ExpenseDetailsDialog } from '@/components/expenses/ExpenseDetailsDialog'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { useTripContext } from '@/hooks/useTripContext'
import { useToast } from '@/hooks/useToast'
import { newExpensePath, tripPath } from '@/routes/paths'
import { EMPTY_EXPENSE_FILTERS, listExpenses, type ExpenseWithSplits } from '@/services/expenseService'
import { hasTripEnded, tripLengthInDays } from '@/utils/tripStatus'

const RECENT_COUNT = 5

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-extrabold text-slate-900 tabular-nums">{value}</p>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function TripOverviewPage() {
  const context = useTripContext()
  const { trip, members, expenseCount, isOwner, effectiveStatus, reload } = context
  const toast = useToast()
  const load = useCallback(() => listExpenses(trip.id, EMPTY_EXPENSE_FILTERS, 0, RECENT_COUNT), [trip.id])
  const recent = useAsync(load)
  const [selected, setSelected] = useState<ExpenseWithSplits | null>(null)
  const ended = effectiveStatus !== 'completed' && hasTripEnded(trip)
  const canAdd = effectiveStatus !== 'completed'

  return (
    <div className="space-y-6">
      {ended && isOwner && (
        <Alert tone="info" title="This trip has ended">
          Once everyone has settled up, mark it as completed in{' '}
          <Link to={tripPath(trip.id, 'settings')} className="font-semibold underline">
            Settings
          </Link>
          .
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={ReceiptText} label="Expenses" value={expenseCount} />
        <Stat icon={Users} label="Travelers" value={members.length} />
        <Stat icon={CalendarRange} label="Days" value={tripLengthInDays(trip.start_date, trip.end_date)} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Recent expenses"
            action={
              expenseCount > 0 && (
                <Link
                  to={tripPath(trip.id, 'expenses')}
                  className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  See all
                </Link>
              )
            }
          />
          <div className="mt-4">
            {!recent.data ? (
              <div className="flex justify-center py-10 text-blue-600">
                <Spinner />
              </div>
            ) : recent.data.items.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No expenses yet."
                description="Start tracking your trip expenses."
                action={
                  canAdd && (
                    <ButtonLink to={newExpensePath(trip.id)} icon={<Plus className="size-5" aria-hidden />}>
                      Add Expense
                    </ButtonLink>
                  )
                }
                className="py-8 sm:py-10"
              />
            ) : (
              <ExpenseList
                expenses={recent.data.items}
                context={context}
                onSelect={setSelected}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Travelers"
            action={
              <Link
                to={tripPath(trip.id, 'people')}
                className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Manage
              </Link>
            }
          />
          <CardBody>
            {members.length === 1 ? (
              <div className="text-center">
                <p className="font-semibold text-slate-900">Invite your travel buddies.</p>
                <p className="mt-1 text-sm text-slate-500">Expenses can only be split with people on the trip.</p>
                {isOwner && (
                  <ButtonLink
                    to={tripPath(trip.id, 'people')}
                    variant="secondary"
                    className="mt-4"
                    icon={<UserPlus className="size-4" aria-hidden />}
                  >
                    Invite Friends
                  </ButtonLink>
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {members.map((member) => (
                  <li key={member.userId} className="flex items-center gap-3">
                    <Avatar name={member.profile.full_name} src={member.profile.avatar_url} size="sm" decorative />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                      {member.profile.full_name}
                    </span>
                    {member.role === 'owner' && <Badge tone="primary">Owner</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {trip.description && (
        <Card>
          <CardHeader title="About this trip" />
          <CardBody>
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-600">{trip.description}</p>
          </CardBody>
        </Card>
      )}

      {/* Mobile: a big, thumb-friendly add button for this trip */}
      {canAdd && (
        <ButtonLink
          to={newExpensePath(trip.id)}
          size="lg"
          fullWidth
          className="sm:hidden"
          icon={<Plus className="size-5" aria-hidden />}
        >
          Add expense to this trip
        </ButtonLink>
      )}

      <ExpenseDetailsDialog
        expense={selected}
        context={context}
        onClose={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null)
          toast.success('Expense deleted.')
          recent.reload()
          reload()
        }}
      />
    </div>
  )
}
