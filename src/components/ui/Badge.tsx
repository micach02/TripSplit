import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'primary' | 'positive' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  primary: 'bg-primary-50 text-primary-700 ring-primary-600/15',
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-orange-50 text-orange-700 ring-orange-600/15',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-transparent ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
