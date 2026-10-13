import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

interface MemberStackProps {
  members: ReadonlyArray<{ userId: string; fullName: string; avatarUrl: string | null }>
  max?: number
  className?: string
}

/** Overlapping avatars: "MR JC SL +2". */
export function MemberStack({ members, max = 4, className }: MemberStackProps) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  const label = members.map((member) => member.fullName).join(', ')

  return (
    <div className={cn('flex items-center -space-x-2', className)} title={label}>
      <span className="sr-only">{`${members.length} ${members.length === 1 ? 'traveler' : 'travelers'}: ${label}`}</span>
      {shown.map((member) => (
        <Avatar
          key={member.userId}
          name={member.fullName}
          src={member.avatarUrl}
          size="sm"
          decorative
          className="ring-2 ring-surface"
        />
      ))}
      {extra > 0 && (
        <span
          className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 ring-2 ring-surface"
          aria-hidden
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
