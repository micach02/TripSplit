import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Clock, MapPin, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useInvitations } from '@/hooks/useInvitations'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { tripPath } from '@/routes/paths'
import { acceptInvitation, declineInvitation, type MyInvitation } from '@/services/memberService'
import { timeframe } from '@/utils/tripKind'
import { expiryLabel } from '@/utils/invitations'

interface InvitationCardProps {
  invitation: MyInvitation
  /** Called after the invitation is answered (to refresh lists). */
  onAnswered: (invitationId: string) => void
}

export function InvitationCard({ invitation, onAnswered }: InvitationCardProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const invitations = useInvitations()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const expiry = expiryLabel(invitation.expiresAt)

  async function accept() {
    setBusy('accept')
    try {
      const tripId = await acceptInvitation(invitation.id)
      toast.success(`You joined ${invitation.tripName}! 🎉`)
      onAnswered(invitation.id)
      invitations.refresh()
      navigate(tripPath(tripId))
    } catch (error) {
      toast.error(getErrorMessage(error))
      setBusy(null)
    }
  }

  async function decline() {
    setBusy('decline')
    try {
      await declineInvitation(invitation.id)
      toast.show('Invitation declined.')
      onAnswered(invitation.id)
      invitations.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error))
      setBusy(null)
    }
  }

  return (
    <Card className="animate-rise-in border-l-4 border-blue-500 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={invitation.invitedByName} src={invitation.invitedByAvatarUrl} size="md" decorative />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{invitation.invitedByName}</span> invited you to join:
          </p>
          <p className="mt-0.5 truncate text-lg font-extrabold text-slate-900">{invitation.tripName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            <span>{timeframe({ kind: invitation.tripKind, startDate: invitation.startDate, endDate: invitation.endDate })}</span>
            {invitation.destination && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {invitation.destination}
              </span>
            )}
          </p>
          <p
            className={cn(
              'mt-1.5 inline-flex items-center gap-1 text-xs font-semibold',
              expiry.soon ? 'text-orange-700' : 'text-slate-500',
            )}
          >
            <Clock className="size-3.5" aria-hidden />
            {expiry.text}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2 sm:justify-end">
        <Button
          variant="outline"
          onClick={decline}
          loading={busy === 'decline'}
          disabled={busy !== null}
          icon={<X className="size-4" aria-hidden />}
          className="flex-1 sm:flex-none"
        >
          Decline
        </Button>
        <Button
          onClick={accept}
          loading={busy === 'accept'}
          disabled={busy !== null}
          icon={<Check className="size-4" aria-hidden />}
          className="flex-1 sm:flex-none"
        >
          Accept
        </Button>
      </div>
    </Card>
  )
}
