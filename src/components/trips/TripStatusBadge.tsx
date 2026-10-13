import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { TripStatus } from '@/types/models'
import type { TripKind } from '@/utils/tripKind'
import { TRIP_STATUS_LABELS } from '@/utils/tripStatus'

const tones: Record<TripStatus, BadgeTone> = {
  upcoming: 'primary',
  active: 'positive',
  completed: 'neutral',
}

/** Budgets don't have trip stages: they're running ("Monthly") or archived. */
const BUDGET_LABELS: Record<TripStatus, string> = {
  upcoming: 'Monthly',
  active: 'Monthly',
  completed: 'Archived',
}

export function TripStatusBadge({
  status,
  kind = 'trip',
  className,
}: {
  status: TripStatus
  kind?: TripKind
  className?: string
}) {
  const running = status !== 'completed'
  return (
    <Badge tone={kind === 'budget' && running ? 'positive' : tones[status]} className={className}>
      {(status === 'active' || (kind === 'budget' && running)) && (
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      )}
      {kind === 'budget' ? BUDGET_LABELS[status] : TRIP_STATUS_LABELS[status]}
    </Badge>
  )
}
