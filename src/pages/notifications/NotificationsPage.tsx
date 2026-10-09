import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { InvitationCard } from '@/components/members/InvitationCard'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/errors'
import { getMyInvitations } from '@/services/memberService'

export default function NotificationsPage() {
  const { data, error } = useAsync(getMyInvitations)
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set())
  const invitations = (data ?? []).filter((invitation) => !answered.has(invitation.id))

  return (
    <>
      <PageTitle title="Notifications" />
      <PageHeader title="Notifications" description="Trip invitations waiting for you." />
      {error && !data ? (
        <Alert tone="error" title="We couldn't load your notifications">
          {getErrorMessage(error)}
        </Alert>
      ) : !data ? (
        <PageLoader />
      ) : invitations.length === 0 ? (
        <Card>
          <EmptyState
            icon={BellRing}
            title="You're all caught up"
            description="When someone invites you to a trip, it will show up here."
          />
        </Card>
      ) : (
        <div className="max-w-2xl space-y-3">
          {invitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onAnswered={(id) => setAnswered((current) => new Set(current).add(id))}
            />
          ))}
        </div>
      )}
    </>
  )
}
