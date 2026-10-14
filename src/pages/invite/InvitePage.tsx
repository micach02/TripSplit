import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CalendarDays, Check, Clock, Link2Off, MapPin, PlaneTakeoff, UserCheck, X } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { useInvitations } from '@/hooks/useInvitations'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { clearPendingInvite } from '@/lib/pendingInvite'
import { invitePath, paths, tripPath } from '@/routes/paths'
import { acceptInvitationLink, declineInvitationLink, getInvitationPreview } from '@/services/memberService'
import { kindCopy, timeframe } from '@/utils/tripKind'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Centered({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg py-4 sm:py-10">
      <PageTitle title={title} />
      {children}
    </div>
  )
}

const backHome = <ButtonLink to={paths.dashboard}>Go to your trips</ButtonLink>

/** Landing page for a shared invite link: /invite/:token */
export default function InvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const validToken = UUID.test(token)
  const load = useCallback(async () => (validToken ? getInvitationPreview(token) : null), [token, validToken])
  const { data: preview, error, loading } = useAsync(load)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [declined, setDeclined] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const invitations = useInvitations()

  // They made it here, so the remembered invite has done its job.
  useEffect(() => {
    clearPendingInvite(invitePath(token))
  }, [token])

  if (error && preview === undefined) {
    return (
      <Centered title="Trip invitation">
        <Alert tone="error" title="We couldn't open this invitation">
          {getErrorMessage(error)}
        </Alert>
      </Centered>
    )
  }
  if (loading && preview === undefined) return <PageLoader label="Opening invitation…" />

  if (!preview) {
    return (
      <Centered title="Invite link not found">
        <Card>
          <EmptyState
            headingLevel={1}
            icon={Link2Off}
            title="This invite link doesn’t work"
            description="It may have been cancelled, or part of the link is missing. Ask whoever sent it to share it again."
            action={backHome}
          />
        </Card>
      </Centered>
    )
  }

  if (preview.alreadyMember) {
    return (
      <Centered title={preview.tripName}>
        <Card>
          <EmptyState
            headingLevel={1}
            icon={UserCheck}
            title={`You’re already on ${preview.tripName}`}
            description={`No need to join again — the ${kindCopy(preview.tripKind).noun} is in your list.`}
            action={<ButtonLink to={tripPath(preview.tripId)}>Open {kindCopy(preview.tripKind).noun}</ButtonLink>}
          />
        </Card>
      </Centered>
    )
  }

  if (declined || preview.status !== 'pending') {
    const copy = declined
      ? {
          icon: X,
          title: 'Invitation declined',
          description: `You won’t be added to ${preview.tripName}. Changed your mind? Ask ${preview.invitedByName} for a new link.`,
        }
      : preview.status === 'expired'
        ? {
            icon: Clock,
            title: 'This invite link has expired',
            description: `Invite links last 7 days. Ask ${preview.invitedByName} to send you a new one.`,
          }
        : {
            icon: Link2Off,
            title: preview.status === 'accepted' ? 'This invite link was already used' : 'This invitation was declined',
            description: `Each invite link works once. Ask ${preview.invitedByName} to send you a new one.`,
          }
    return (
      <Centered title="Trip invitation">
        <Card>
          <EmptyState icon={copy.icon} headingLevel={1} title={copy.title} description={copy.description} action={backHome} />
        </Card>
      </Centered>
    )
  }

  async function accept() {
    setBusy('accept')
    setActionError(null)
    try {
      const tripId = await acceptInvitationLink(token)
      toast.success(`You joined ${preview?.tripName ?? 'the trip'}! 🎉`)
      invitations.refresh()
      navigate(tripPath(tripId), { replace: true })
    } catch (caught) {
      setActionError(getErrorMessage(caught))
      setBusy(null)
    }
  }

  async function decline() {
    setBusy('decline')
    setActionError(null)
    try {
      await declineInvitationLink(token)
      setDeclined(true)
      invitations.refresh()
    } catch (caught) {
      setActionError(getErrorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Centered title={`Join ${preview.tripName}`}>
      <Card className="animate-rise-in overflow-hidden">
        <div className="bg-linear-to-br from-brand-600 to-sky-500 px-5 pt-6 pb-8 text-white sm:px-6">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white/15">
            <PlaneTakeoff className="size-6" aria-hidden />
          </span>
          <p className="mt-4 text-sm font-medium text-white/90">You’re invited to join</p>
          <h1 className="mt-0.5 text-2xl font-extrabold wrap-break-word">{preview.tripName}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              {timeframe({ kind: preview.tripKind, startDate: preview.startDate, endDate: preview.endDate })}
            </span>
            {preview.destination && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {preview.destination}
              </span>
            )}
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Avatar name={preview.invitedByName} src={preview.invitedByAvatarUrl} size="md" decorative />
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{preview.invitedByName}</span> invited{' '}
              {preview.invitedName ? <span className="font-semibold text-slate-900">{preview.invitedName}</span> : 'you'}{' '}
              to split costs on this {kindCopy(preview.tripKind).noun}.
            </p>
          </div>

          {preview.personName ? (
            <p className="rounded-2xl bg-blue-50 p-3 text-sm text-slate-700 ring-1 ring-blue-100">
              You’ll take <span className="font-semibold text-slate-900">{preview.personName}</span>’s place on this{' '}
              {kindCopy(preview.tripKind).noun}: the expenses and balances already recorded for {preview.personName} become
              yours.
            </p>
          ) : null}
          <p className="text-sm text-slate-500">
            Once you join, you’ll see this {kindCopy(preview.tripKind).noun}’s expenses and balances, and can add your own.
          </p>

          {actionError && <Alert tone="error">{actionError}</Alert>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={decline}
              loading={busy === 'decline'}
              disabled={busy !== null}
              icon={<X className="size-4" aria-hidden />}
            >
              Decline
            </Button>
            <Button
              onClick={accept}
              loading={busy === 'accept'}
              disabled={busy !== null}
              icon={<Check className="size-4" aria-hidden />}
            >
              {`Join ${kindCopy(preview.tripKind).noun}`}
            </Button>
          </div>
        </div>
      </Card>
    </Centered>
  )
}
