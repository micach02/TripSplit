import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BellRing, TriangleAlert, X } from 'lucide-react'
import { InvitationCard } from '@/components/members/InvitationCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useInvitations } from '@/hooks/useInvitations'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { tripPath } from '@/routes/paths'

export default function NotificationsPage() {
  const { invitations: data, error, refresh, refreshIfStale, alerts, dismissAlert } = useInvitations()
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set())
  const invitations = (data ?? []).filter((invitation) => !answered.has(invitation.id))

  // The shared list can be a couple of minutes old; opening this page re-checks.
  // (Once a load finishes the list is fresh, so this doesn't loop.)
  useEffect(() => {
    refreshIfStale(15_000)
  }, [refreshIfStale])

  return (
    <>
      <PageTitle title="Notifications" />
      <PageHeader title="Notifications" description="Invitations and budget alerts." />
      <div className="max-w-2xl space-y-6">
        {alerts.length > 0 && (
          <section aria-labelledby="alerts-heading">
            <h2 id="alerts-heading" className="mb-3 text-sm font-semibold text-slate-700">
              Budget alerts
            </h2>
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={cn(
                    'animate-fade-in flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1',
                    alert.level === 'over' ? 'ring-red-200' : 'ring-orange-200',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl',
                      alert.level === 'over' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-700',
                    )}
                  >
                    <TriangleAlert className="size-5" aria-hidden />
                  </span>
                  <Link to={tripPath(alert.tripId, 'analytics')} className="min-w-0 flex-1 rounded-lg">
                    <p className="font-semibold text-slate-900">{alert.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{alert.message}</p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismissAlert(alert.id)}
                    className="-m-1 rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Dismiss: ${alert.title}`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && !data ? (
          <Alert tone="error" title="We couldn't load your invitations">
            <p>{getErrorMessage(error)}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
              Try again
            </Button>
          </Alert>
        ) : !data ? (
          <Card className="overflow-hidden">
            <ListSkeleton rows={2} label="Loading notifications…" />
          </Card>
        ) : invitations.length > 0 ? (
          <section aria-labelledby="invitations-heading" className="space-y-3">
            <h2 id="invitations-heading" className="text-sm font-semibold text-slate-700">
              Invitations
            </h2>
            {invitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                onAnswered={(id) => setAnswered((current) => new Set(current).add(id))}
              />
            ))}
          </section>
        ) : (
          alerts.length === 0 && (
            <Card>
              <EmptyState
                icon={BellRing}
                title="You're all caught up"
                description="Invitations, and alerts when a budget is nearly used up, will show up here."
              />
            </Card>
          )
        )}
      </div>
    </>
  )
}
