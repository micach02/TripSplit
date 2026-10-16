import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

type StatTone = 'primary' | 'neutral' | 'positive' | 'negative'

const tones: Record<StatTone, { icon: string; value: string }> = {
  primary: { icon: 'bg-primary-50 text-primary-600', value: 'text-slate-900' },
  neutral: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
  positive: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  negative: { icon: 'bg-red-50 text-red-600', value: 'text-red-700' },
}

interface StatCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  tone?: StatTone
  hint?: ReactNode
}

export function StatCard({ label, value, icon: Icon, tone = 'neutral', hint }: StatCardProps) {
  const styles = tones[tone]
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', styles.icon)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
      </div>
      {/* Proportional figures for a standalone value (tabular only for aligned columns) */}
      <p className={cn('mt-3 truncate text-xl font-extrabold tracking-tight sm:text-2xl', styles.value)}>
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs font-medium text-slate-500">{hint}</p>}
    </Card>
  )
}

export function StatCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5" aria-hidden>
      <div className="flex animate-pulse items-center gap-3">
        <span className="size-9 rounded-xl bg-slate-100" />
        <span className="h-3.5 w-20 rounded bg-slate-100" />
      </div>
      <div className="mt-4 h-6 w-28 animate-pulse rounded bg-slate-100" />
    </Card>
  )
}
