import { useState } from 'react'
import { LogOut, Pencil, Send, UserMinus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import { removeMember, removePerson } from '@/services/memberService'
import type { TripMemberWithProfile } from '@/services/tripService'
import { formatDate } from '@/utils/format'
import { isNamedPerson } from '@/utils/people'

interface MemberListProps {
  tripId: string
  tripName: string
  /** "trip" or "budget" */
  noun?: string
  members: TripMemberWithProfile[]
  currentUserId: string
  isOwner: boolean
  /** After someone is removed. `self` is true when the current user left. */
  onRemoved: (userId: string, self: boolean) => void
  /** Rename someone added by name (offered to the owner and whoever added them). */
  onRename: (member: TripMemberWithProfile) => void
  /** Invite someone added by name to the app (owners only). */
  onInvite?: (member: TripMemberWithProfile) => void
}

const iconButton = 'rounded-full p-3 text-slate-500 transition-colors sm:p-2.5'

export function MemberList({
  tripId,
  tripName,
  noun = 'trip',
  members,
  currentUserId,
  isOwner,
  onRemoved,
  onRename,
  onInvite,
}: MemberListProps) {
  const [target, setTarget] = useState<TripMemberWithProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const leaving = target?.userId === currentUserId
  const named = target !== null && isNamedPerson(target)
  const nameOf = (userId: string | null) => members.find((member) => member.userId === userId)?.profile.full_name

  async function confirm() {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      if (isNamedPerson(target)) await removePerson(target.userId)
      else await removeMember(tripId, target.userId)
      const self = target.userId === currentUserId
      setTarget(null)
      onRemoved(target.userId, self)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {members.map((member) => {
          const isMe = member.userId === currentUserId
          const byName = isNamedPerson(member)
          const canManage = byName && (isOwner || member.profile.added_by === currentUserId)
          const canRemove = byName ? canManage : member.role !== 'owner' && (isOwner || isMe)
          const addedBy = member.profile.added_by === currentUserId ? 'you' : nameOf(member.profile.added_by)
          return (
            <li key={member.userId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <Avatar name={member.profile.full_name} src={member.profile.avatar_url} size="md" decorative />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold text-slate-900">
                  <span className="truncate">{member.profile.full_name}</span>
                  {isMe && <span className="text-sm font-normal text-slate-500">(you)</span>}
                </p>
                {byName ? (
                  <p className="truncate text-sm text-slate-500">
                    No account{addedBy ? ` · added by ${addedBy}` : ''}
                  </p>
                ) : (
                  <>
                    <p className="truncate text-sm text-slate-500">{member.profile.email}</p>
                    <p className="text-xs text-slate-500">Joined {formatDate(member.joinedAt)}</p>
                  </>
                )}
              </div>
              {member.role === 'owner' ? <Badge tone="primary">Owner</Badge> : !byName && <Badge>Member</Badge>}
              <div className="flex shrink-0">
                {byName && onInvite && (
                  <button
                    type="button"
                    onClick={() => onInvite(member)}
                    className={`${iconButton} hover:bg-primary-50 hover:text-primary-700`}
                    aria-label={`Invite ${member.profile.full_name} to the app`}
                    title="Invite to the app (optional)"
                  >
                    <Send className="size-5" aria-hidden />
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onRename(member)}
                    className={`${iconButton} hover:bg-slate-100 hover:text-slate-700`}
                    aria-label={`Rename ${member.profile.full_name}`}
                    title="Rename"
                  >
                    <Pencil className="size-5" aria-hidden />
                  </button>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setTarget(member)
                    }}
                    className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
                    aria-label={isMe ? `Leave ${noun}` : `Remove ${member.profile.full_name}`}
                    title={isMe ? `Leave ${noun}` : `Remove from ${noun}`}
                  >
                    {isMe ? <LogOut className="size-5" aria-hidden /> : <UserMinus className="size-5" aria-hidden />}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
        loading={busy}
        error={error}
        title={leaving ? `Leave ${tripName}?` : `Remove ${target?.profile.full_name ?? ''}?`}
        confirmLabel={leaving ? `Leave ${noun}` : 'Remove'}
      >
        <p>
          {leaving
            ? 'You’ll lose access to this trip’s expenses and balances. The owner can invite you again later.'
            : named
              ? `They’ll no longer be on this ${noun}. People who have paid for or shared in expenses can’t be removed.`
              : `They’ll lose access to this ${noun}. People who have paid for or shared in expenses can’t be removed.`}
        </p>
      </ConfirmDialog>
    </>
  )
}
