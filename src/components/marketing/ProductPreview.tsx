import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/utils/calculations/money'

const travelers = [
  { initials: 'MR', className: 'bg-primary-100 text-primary-700' },
  { initials: 'JC', className: 'bg-emerald-100 text-emerald-700' },
  { initials: 'SL', className: 'bg-violet-100 text-violet-700' },
  { initials: 'AT', className: 'bg-amber-100 text-amber-800' },
]

/** A tiny, decorative preview of what TripSplit does: one split expense. */
export function ExpensePreview({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('rounded-2xl bg-surface p-5 text-slate-900 shadow-2xl shadow-primary-950/25', className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-orange-50 text-xl">🍜</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">Dinner at Lau Pa Sat</p>
          <p className="text-sm text-slate-500">Paid by Michael · Split 4 ways</p>
        </div>
        <p className="font-bold">{formatMoney(250000, 'PHP')}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex -space-x-1.5">
          {travelers.map((traveler) => (
            <span
              key={traveler.initials}
              className={`flex size-9 items-center justify-center rounded-full text-xs font-bold ring-2 ring-surface ${traveler.className}`}
            >
              {traveler.initials}
            </span>
          ))}
        </div>
        <p className="text-sm font-semibold text-emerald-700">{formatMoney(62500, 'PHP')} each</p>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold text-slate-500">
          <span>Trip budget</span>
          <span>64.9% spent</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[64.9%] rounded-full bg-primary-600" />
        </div>
      </div>
    </div>
  )
}

/** Decorative: the "settle up" suggestion TripSplit works out. */
export function SettlePreview({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('rounded-2xl bg-surface p-4 text-slate-900 shadow-xl shadow-primary-950/20', className)}>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Settle up</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">JC</span>
        <ArrowRight className="size-4 text-slate-400" />
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">MR</span>
        <span className="ml-auto font-bold tabular-nums">{formatMoney(125000, 'PHP')}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">1 payment settles the whole trip.</p>
    </div>
  )
}
