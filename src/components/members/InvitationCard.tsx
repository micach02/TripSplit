import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, MapPin, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { tripPath } from '@/routes/paths'
import { acceptInvitation, declineInvitation, type MyInvitation } from '@/services/memberService'
import { formatDateRange } from '@/utils/format'

interface InvitationCardProps {
  invitation: MyInvitation
  /** Called after the invitation is answered (to refresh lists). */
  onAnswered: (invitationId: string) => void
}

export function InvitationCard({ invitation, onAnswered }: InvitationCardProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)

  async function accept() {
    setBusy('accept')
    try {
      const tripId = await acceptInvitation(invitation.id)
      toast.success(`You joined ${invitation.tripName}! 🎉`)
      onAnswered(invitation.id)
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
            <span>{formatDateRange(invitation.startDate, invitation.endDate)}</span>
            {invitation.destination && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {invitation.destination}
              </span>
            )}
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
