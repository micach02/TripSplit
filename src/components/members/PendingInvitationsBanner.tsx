import { useState } from 'react'
import { InvitationCard } from '@/components/members/InvitationCard'
import { useInvitations } from '@/hooks/useInvitations'

/** Invitations waiting for the signed-in user; renders nothing when there are none. */
export function PendingInvitationsBanner({ onAccepted }: { onAccepted?: () => void }) {
  const { invitations: all } = useInvitations()
  // Hide answered cards straight away; the shared list catches up on refresh.
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set())
  const invitations = (all ?? []).filter((invitation) => !answered.has(invitation.id))

  if (invitations.length === 0) return null

  return (
    <section aria-label="Trip invitations" className="space-y-3">
      {invitations.map((invitation) => (
        <InvitationCard
          key={invitation.id}
          invitation={invitation}
          onAnswered={(id) => {
            setAnswered((current) => new Set(current).add(id))
            onAccepted?.()
          }}
        />
      ))}
    </section>
  )
}
