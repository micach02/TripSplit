import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  /** 1 when the empty state is the whole page (404, a broken link…); otherwise it sits under a page heading. */
  headingLevel?: 1 | 2 | 3
}

export function EmptyState({ icon: Icon, title, description, action, className, headingLevel = 2 }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center sm:py-16', className)}>
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-8 ring-blue-50/50">
        <Icon className="size-8" strokeWidth={1.75} aria-hidden />
      </div>
      <Heading className="text-lg font-bold text-slate-900">{title}</Heading>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
