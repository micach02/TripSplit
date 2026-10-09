import { useCallback, useState, type FormEvent } from 'react'
import { Check, Copy, Link2, Mail, Send, Share2, X } from 'lucide-react'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'
import { copyText } from '@/lib/clipboard'
import { getErrorMessage } from '@/lib/errors'
import { invitationLink, inviteToTrip, listPendingInvitations, revokeInvitation } from '@/services/memberService'
import type { TripInvitation } from '@/types/models'
import { formatRelative } from '@/utils/format'
import { invitationMessage } from '@/utils/invitations'
import { validateEmail } from '@/utils/validation'

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** Owner tools: invite people, share their invite links, and cancel pending invitations. */
export function InvitePanel({ tripId, tripName }: { tripId: string; tripName: string }) {
  const toast = useToast()
  const { profile } = useAuth()
  const load = useCallback(() => listPendingInvitations(tripId), [tripId])
  const { data: pending, reload } = useAsync(load)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [sending, setSending] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [showLink, setShowLink] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = {
      name: !name.trim() ? 'Enter their name.' : name.trim().length > 100 ? 'Keep the name under 100 characters.' : undefined,
      email: validateEmail(email) ?? undefined,
    }
    setErrors(found)
    if (found.name || found.email) return focusFirstInvalid(form)

    setSending(true)
    try {
      const invitation = await inviteToTrip(tripId, email, name)
      toast.success(`Invite for ${name.trim()} is ready — send them the link.`)
      setJustCreated(invitation.id)
      setName('')
      setEmail('')
      reload()
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

  async function revoke(invitationId: string) {
    setRevoking(invitationId)
    try {
      await revokeInvitation(invitationId)
      reload()
    } catch (caught) {
      toast.error(getErrorMessage(caught))
    } finally {
      setRevoking(null)
    }
  }

  async function copyLink(invitation: TripInvitation) {
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

  async function share(invitation: TripInvitation) {
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
        <TextField
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

      {pending && pending.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Pending invitations</h3>
          <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {pending.map((invitation) => {
              const label = invitation.invited_name ?? invitation.invited_email
              const fresh = invitation.id === justCreated
              return (
                <li key={invitation.id} className={cn('px-3 py-3', fresh && 'animate-fade-in bg-blue-50/60')}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Mail className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{label}</p>
                      <p className="truncate text-xs text-slate-500">
                        {invitation.invited_name && `${invitation.invited_email} · `}Created{' '}
                        {formatRelative(invitation.created_at)}
                      </p>
                    </div>
                  </div>
                  {fresh && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-blue-800">
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
                      onClick={() => revoke(invitation.id)}
                      loading={revoking === invitation.id}
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
    </div>
  )
}
