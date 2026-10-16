import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardTone = 'default' | 'positive' | 'negative' | 'danger'

// Background and ring live here (not in className) so a tone can't lose a
// class-order fight with the defaults.
const tones: Record<CardTone, string> = {
  default: 'bg-surface ring-slate-900/[0.04]',
  positive: 'bg-emerald-50 ring-emerald-200',
  negative: 'bg-red-50 ring-red-200',
  danger: 'bg-surface ring-red-200',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
}

export function Card({ tone = 'default', className, ...props }: CardProps) {
  return <div className={cn('rounded-3xl shadow-card ring-1', tones[tone], className)} {...props} />
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />
}
