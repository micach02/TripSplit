import { Split } from 'lucide-react'
import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-blue-700 text-white shadow-sm shadow-blue-700/30',
        className,
      )}
      aria-hidden
    >
      <Split className="size-[55%]" strokeWidth={2.5} />
    </span>
  )
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={inverted ? 'bg-none bg-white/15 shadow-none ring-1 ring-white/25' : undefined} />
      <span className={cn('text-lg font-extrabold tracking-tight', inverted ? 'text-white' : 'text-slate-900')}>
        Trip<span className={inverted ? 'text-blue-100' : 'text-blue-600'}>Split</span>
      </span>
    </span>
  )
}
