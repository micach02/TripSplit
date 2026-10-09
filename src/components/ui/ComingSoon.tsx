import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'

interface ComingSoonProps {
  title: string
  icon: LucideIcon
  phase: string
  description: string
}

/** Placeholder for screens scheduled in a later development phase. */
export function ComingSoon({ title, icon, phase, description }: ComingSoonProps) {
  return (
    <>
      <PageTitle title={title} />
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={icon}
          title="Coming soon"
          description={description}
          action={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{phase}</span>
          }
        />
      </Card>
    </>
  )
}
