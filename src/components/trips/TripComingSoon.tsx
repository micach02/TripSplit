import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

/** Placeholder for a trip tab scheduled in a later phase. */
export function TripComingSoon({ icon, title, description, phase }: { icon: LucideIcon; title: string; description: string; phase: string }) {
  return (
    <Card>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{phase}</span>}
      />
    </Card>
  )
}
