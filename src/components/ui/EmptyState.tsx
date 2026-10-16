import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  /** Shown instead of the icon, e.g. "🧳" */
  emoji?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  /** 1 when the empty state is the whole page (404, a broken link…); otherwise it sits under a page heading. */
  headingLevel?: 1 | 2 | 3
}

export function EmptyState({ icon: Icon, emoji, title, description, action, className, headingLevel = 2 }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center sm:py-16', className)}>
      <div
        aria-hidden
        className="mb-5 flex size-20 items-center justify-center rounded-full bg-coral-50 text-coral-600 ring-8 ring-coral-50/60"
      >
        {emoji ? <span className="text-4xl">{emoji}</span> : <Icon className="size-9" strokeWidth={1.75} />}
      </div>
      <Heading className="text-lg font-bold text-slate-900">{title}</Heading>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
