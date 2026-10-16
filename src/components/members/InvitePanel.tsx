import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Check, Clock, Copy, Link2, Mail, RotateCcw, Send, Share2, X, XCircle } from 'lucide-react'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'
import { copyText } from '@/lib/clipboard'
import { getErrorMessage } from '@/lib/errors'
import {
  invitationLink,
  inviteToTrip,
  listTripInvitations,
  renewInvitation,
  revokeInvitation,
  type ManagedInvitation,
} from '@/services/memberService'
import { formatRelative } from '@/utils/format'
import { expiryLabel, invitationMessage } from '@/utils/invitations'
import { validateEmail } from '@/utils/validation'

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

const labelFor = (invitation: ManagedInvitation) => invitation.invited_name ?? invitation.invited_email

/**
 * Invitations that didn't work out, newest per person, leaving out anyone who
 * already has a newer invitation waiting.
 */
function closedInvitations(all: ManagedInvitation[]): ManagedInvitation[] {
  const waiting = new Set(all.filter((i) => i.state === 'pending').map((i) => i.invited_email))
  const seen = new Set<string>()
  return all.filter((invitation) => {
    if (invitation.state === 'pending' || waiting.has(invitation.invited_email) || seen.has(invitation.invited_email)) {
      return false
    }
    seen.add(invitation.invited_email)
    return true
  })
}

interface InvitePanelProps {
  tripId: string
  tripName: string
  /** Someone added by name to invite: whoever accepts takes their place. */
  person?: { id: string; name: string } | null
  /** The invite for `person` was created, or the owner chose to invite someone else. */
  onPersonDone?: () => void
}

/** Owner tools: invite people, share links, and follow invitations through to joining or not. */
export function InvitePanel({ tripId, tripName, person = null, onPersonDone }: InvitePanelProps) {
  const emailId = useId()
  const toast = useToast()
  const { profile } = useAuth()
  const load = useCallback(() => listTripInvitations(tripId), [tripId])
  const { data, reload } = useAsync(load)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [showLink, setShowLink] = useState<string | null>(null)

  // Straight to the email when "Invite to the app" was chosen for someone on the list.
  useEffect(() => {
    if (person) document.getElementById(emailId)?.focus()
  }, [person, emailId])

  const pending = (data ?? []).filter((invitation) => invitation.state === 'pending')
  const closed = closedInvitations(data ?? [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const invitedName = person?.name ?? name.trim()
    const found = {
      name: person
        ? undefined
        : !invitedName
          ? 'Enter their name.'
          : invitedName.length > 100
            ? 'Keep the name under 100 characters.'
            : undefined,
      email: validateEmail(email) ?? undefined,
    }
    setErrors(found)
    if (found.name || found.email) return focusFirstInvalid(form)

    setSending(true)
    try {
      const invitation = await inviteToTrip(tripId, email, invitedName, person?.id)
      toast.success(`Invite for ${invitedName} is ready — send them the link.`)
      setJustCreated(invitation.id)
      setName('')
      setEmail('')
      reload()
      onPersonDone?.()
    } catch (caught) {
      // 23505: there's already a pending invitation for this email
      setErrors({
        email:
          (caught as { code?: string } | null)?.code === '23505'
            ? 'This person already has a pending invitation. Share its link below.'
            : getErrorMessage(caught),
      })
    } finally {
      setSending(false)
    }
  }

  async function revoke(invitation: ManagedInvitation) {
    setBusy(invitation.id)
    try {
      await revokeInvitation(invitation.id)
      reload()
    } catch (caught) {
      toast.error(getErrorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  async function renew(invitation: ManagedInvitation) {
    setBusy(invitation.id)
    try {
      const renewed = await renewInvitation(invitation.id)
      toast.success(`New invite for ${labelFor(invitation)} is ready — send them the new link.`)
      setJustCreated(renewed.id)
      setShowLink(null)
      reload()
    } catch (caught) {
      toast.error(getErrorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  async function copyLink(invitation: ManagedInvitation) {
    if (await copyText(invitationLink(invitation.token))) {
      setCopied(invitation.id)
      setShowLink(null)
      toast.success('Invite link copied.')
      window.setTimeout(() => setCopied((current) => (current === invitation.id ? null : current)), 2500)
    } else {
      // Let them copy it by hand.
      setShowLink(invitation.id)
    }
  }

  async function share(invitation: ManagedInvitation) {
    try {
      await navigator.share({
        title: `Join ${tripName} on TripSplit`,
        text: invitationMessage({
          inviterName: profile?.full_name,
          tripName,
          invitedName: invitation.invited_name,
        }),
        url: invitationLink(invitation.token),
      })
    } catch (caught) {
      // Closing the share sheet isn't an error.
      if ((caught as { name?: string } | null)?.name !== 'AbortError') void copyLink(invitation)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {person ? (
          <div className="rounded-2xl bg-primary-50 p-3 text-sm ring-1 ring-primary-100">
            <p className="font-semibold text-slate-900">Inviting {person.name}</p>
            <p className="mt-0.5 text-slate-600">
              When they accept, everything recorded for {person.name} becomes theirs.
            </p>
            <button
              type="button"
              onClick={onPersonDone}
              className="tap-target mt-1 font-semibold text-primary-600 hover:text-primary-700"
            >
              Invite someone else instead
            </button>
          </div>
        ) : (
          <TextField
            label="Name"
            autoComplete="off"
            autoCapitalize="words"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            placeholder="John Cruz"
            maxLength={100}
          />
        )}
        <TextField
          id={emailId}
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          placeholder="john@example.com"
          hint="You’ll get a link to send them. They can also find the invite by logging in with this email."
        />
        <Button type="submit" loading={sending} icon={<Send className="size-4" aria-hidden />} fullWidth>
          Create invite
        </Button>
      </form>

      {pending.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Pending invitations</h3>
          <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {pending.map((invitation) => {
              const label = labelFor(invitation)
              const fresh = invitation.id === justCreated
              const expiry = expiryLabel(invitation.expires_at)
              return (
                <li key={invitation.id} className={cn('px-3 py-3', fresh && 'animate-fade-in bg-primary-50/60')}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Mail className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{label}</p>
                      <p className="truncate text-xs text-slate-500">
                        {invitation.invited_name && `${invitation.invited_email} · `}
                        <span className={cn(expiry.soon && 'font-semibold text-orange-700')}>{expiry.text}</span>
                      </p>
                    </div>
                  </div>
                  {fresh && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-primary-800">
                      <Link2 className="mt-px size-3.5 shrink-0" aria-hidden />
                      Send this link to {label}. It works once and expires in 7 days.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 sm:pl-12">
                    {canShare && (
                      <Button
                        size="sm"
                        variant={fresh ? 'primary' : 'outline'}
                        onClick={() => share(invitation)}
                        icon={<Share2 className="size-4" aria-hidden />}
                        aria-label={`Share the invite link for ${label}`}
                      >
                        Share
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={fresh && !canShare ? 'primary' : 'outline'}
                      onClick={() => copyLink(invitation)}
                      icon={
                        copied === invitation.id ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <Copy className="size-4" aria-hidden />
                        )
                      }
                      aria-label={`Copy the invite link for ${label}`}
                    >
                      {copied === invitation.id ? 'Copied' : 'Copy link'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(invitation)}
                      loading={busy === invitation.id}
                      icon={<X className="size-4" aria-hidden />}
                      aria-label={`Cancel the invitation to ${label}`}
                      className="max-sm:ml-auto"
                    >
                      <span className="max-sm:sr-only">Cancel</span>
                    </Button>
                  </div>
                  {showLink === invitation.id && (
                    <div className="mt-2 sm:pl-12">
                      <label className="text-xs font-semibold text-slate-600" htmlFor={`invite-link-${invitation.id}`}>
                        Couldn’t copy automatically. Select the link and copy it:
                      </label>
                      <input
                        id={`invite-link-${invitation.id}`}
                        readOnly
                        autoFocus
                        value={invitationLink(invitation.token)}
                        onFocus={(event) => event.currentTarget.select()}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-700"
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Didn’t join</h3>
          <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {closed.map((invitation) => {
              const label = labelFor(invitation)
              const expired = invitation.state === 'expired'
              const StatusIcon = expired ? Clock : XCircle
              return (
                <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <StatusIcon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{label}</p>
                    <p className="truncate text-xs text-slate-500">
                      {expired ? `Expired ${formatRelative(invitation.expires_at)}` : 'Declined the invitation'}
                    </p>
                  </div>
                  <div className="flex gap-1 max-sm:w-full max-sm:pl-12">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => renew(invitation)}
                      loading={busy === invitation.id}
                      disabled={busy !== null && busy !== invitation.id}
                      icon={<RotateCcw className="size-4" aria-hidden />}
                      aria-label={`Invite ${label} again`}
                    >
                      Invite again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revoke(invitation)}
                      disabled={busy !== null}
                      icon={<X className="size-4" aria-hidden />}
                      aria-label={`Remove ${label} from this list`}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
