import { useState } from 'react'
import { LogOut, UserMinus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import { removeMember } from '@/services/memberService'
import type { TripMemberWithProfile } from '@/services/tripService'
import { formatDate } from '@/utils/format'

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
}

export function MemberList({ tripId, tripName, noun = 'trip', members, currentUserId, isOwner, onRemoved }: MemberListProps) {
  const [target, setTarget] = useState<TripMemberWithProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const leaving = target?.userId === currentUserId

  async function confirm() {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await removeMember(tripId, target.userId)
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
          const canRemove = member.role !== 'owner' && (isOwner || isMe)
          return (
            <li key={member.userId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <Avatar name={member.profile.full_name} src={member.profile.avatar_url} size="md" decorative />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold text-slate-900">
                  <span className="truncate">{member.profile.full_name}</span>
                  {isMe && <span className="text-sm font-normal text-slate-500">(you)</span>}
                </p>
                <p className="truncate text-sm text-slate-500">{member.profile.email}</p>
                <p className="text-xs text-slate-500">Joined {formatDate(member.joinedAt)}</p>
              </div>
              {member.role === 'owner' ? (
                <Badge tone="primary">Owner</Badge>
              ) : (
                <Badge>Member</Badge>
              )}
              {canRemove && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setTarget(member)
                  }}
                  className="rounded-full p-3 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 sm:p-2.5"
                  aria-label={isMe ? `Leave ${noun}` : `Remove ${member.profile.full_name}`}
                  title={isMe ? `Leave ${noun}` : `Remove from ${noun}`}
                >
                  {isMe ? <LogOut className="size-5" aria-hidden /> : <UserMinus className="size-5" aria-hidden />}
                </button>
              )}
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
            : `They’ll lose access to this ${noun}. People who have paid for or shared in expenses can’t be removed.`}
        </p>
      </ConfirmDialog>
    </>
  )
}
