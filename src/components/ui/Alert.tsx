import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

type AlertTone = 'error' | 'success' | 'info' | 'warning'

const tones: Record<AlertTone, { icon: typeof Info; className: string; iconClassName: string }> = {
  error: { icon: CircleAlert, className: 'bg-red-50 text-red-800 ring-red-200', iconClassName: 'text-red-500' },
  success: { icon: CircleCheck, className: 'bg-emerald-50 text-emerald-800 ring-emerald-200', iconClassName: 'text-emerald-500' },
  info: { icon: Info, className: 'bg-primary-50 text-primary-800 ring-primary-200', iconClassName: 'text-primary-500' },
  warning: { icon: TriangleAlert, className: 'bg-orange-50 text-orange-900 ring-orange-200', iconClassName: 'text-orange-500' },
}

interface AlertProps {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  className?: string
}

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const { icon: Icon, className: toneClassName, iconClassName } = tones[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('animate-fade-in flex gap-3 rounded-xl p-3.5 text-sm ring-1 ring-inset', toneClassName, className)}
    >
      <Icon className={cn('mt-px size-5 shrink-0', iconClassName)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}
