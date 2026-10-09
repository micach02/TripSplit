import { cn } from '@/lib/cn'

export type ProgressTone = 'neutral' | 'positive' | 'warning' | 'danger'

// Meter: the fill carries the state; the track is a lighter step of the same hue,
// so the state reads across the whole bar.
const toneClasses: Record<ProgressTone, { fill: string; track: string }> = {
  neutral: { fill: 'bg-blue-600', track: 'bg-blue-100' },
  positive: { fill: 'bg-emerald-500', track: 'bg-emerald-100' },
  warning: { fill: 'bg-orange-500', track: 'bg-orange-100' },
  danger: { fill: 'bg-red-500', track: 'bg-red-100' },
}

interface ProgressBarProps {
  /** 0–100; values outside the range are clamped for display. */
  value: number
  tone?: ProgressTone
  label: string
  className?: string
}

export function ProgressBar({ value, tone = 'neutral', label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const { fill, track } = toneClasses[tone]
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn('h-2 overflow-hidden rounded-full', track, className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fill)} style={{ width: `${clamped}%` }} />
    </div>
  )
}
