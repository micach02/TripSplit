import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { TripStatus } from '@/types/models'
import { TRIP_STATUS_LABELS } from '@/utils/tripStatus'

const tones: Record<TripStatus, BadgeTone> = {
  upcoming: 'primary',
  active: 'positive',
  completed: 'neutral',
}

export function TripStatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  return (
    <Badge tone={tones[status]} className={className}>
      {status === 'active' && <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />}
      {TRIP_STATUS_LABELS[status]}
    </Badge>
  )
}
