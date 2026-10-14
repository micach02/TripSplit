import { useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import type { TripMemberWithProfile } from '@/services/tripService'
import { shortName } from '@/utils/people'

interface BaseProps {
  label: string
  members: TripMemberWithProfile[]
  currentUserId: string
  action?: ReactNode
}

/** "You", or a first name — the full name when someone else here shares it. */
function chipName(member: TripMemberWithProfile, members: TripMemberWithProfile[], currentUserId: string): string {
  if (member.userId === currentUserId) return 'You'
  const others = members.filter((other) => other.userId !== member.userId).map((other) => other.profile.full_name)
  return shortName(member.profile.full_name, others) || 'Traveler'
}

const chipClasses = (selected: boolean) =>
  cn(
    'flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-sm font-semibold transition',
    selected
      ? 'bg-brand-600 text-white shadow-sm shadow-blue-600/25'
      : 'bg-surface text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
  )

/** Pick exactly one member (e.g. who paid). */
export function MemberRadioChips({
  label,
  members,
  currentUserId,
  value,
  onChange,
}: BaseProps & { value: string; onChange: (userId: string) => void }) {
  const labelId = useId()
  return (
    <div>
      <p id={labelId} className="mb-2 text-sm font-semibold text-slate-700">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {members.map((member) => {
          const selected = member.userId === value
          return (
            <button
              key={member.userId}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(member.userId)}
              className={chipClasses(selected)}
            >
              <Avatar name={member.profile.full_name} src={member.profile.avatar_url} size="sm" decorative />
              {chipName(member, members, currentUserId)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Pick any number of members (e.g. who shares an expense). */
export function MemberCheckboxChips({
  label,
  members,
  currentUserId,
  selected,
  onToggle,
  action,
}: BaseProps & { selected: ReadonlySet<string>; onToggle: (userId: string) => void }) {
  const labelId = useId()
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p id={labelId} className="text-sm font-semibold text-slate-700">
          {label}
        </p>
        {action}
      </div>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {members.map((member) => {
          const isSelected = selected.has(member.userId)
          return (
            <button
              key={member.userId}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => onToggle(member.userId)}
              className={chipClasses(isSelected)}
            >
              <span className="relative">
                <Avatar name={member.profile.full_name} src={member.profile.avatar_url} size="sm" decorative />
                {isSelected && (
                  <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-surface text-blue-600 ring-1 ring-blue-600">
                    <Check className="size-2.5" strokeWidth={4} aria-hidden />
                  </span>
                )}
              </span>
              {chipName(member, members, currentUserId)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
