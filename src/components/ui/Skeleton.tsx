import { cn } from '@/lib/cn'

/**
 * Loading placeholders shaped like the content they stand in for, so the page
 * doesn't jump when data arrives. They pulse unless reduced motion is on.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded-lg bg-slate-200/70', className)} />
}

/** Rows shaped like the expense list. */
export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" className="divide-y divide-slate-100">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <Skeleton className="size-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-3 w-1/2" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-4/5" />
      </div>
    </div>
  )
}

/** A page (or a tab) whose code or data is still loading. */
export function PageSkeleton({ label = 'Loading…', heading = true }: { label?: string; heading?: boolean }) {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{label}</span>
      {heading && (
        <div className="space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton className="max-lg:hidden" />
      </div>
    </div>
  )
}

/** Trip pages: back link, cover + budget card, tabs, content. Matches TripHeader's shape. */
export function TripPageSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading trip…</span>
      <Skeleton className="h-4 w-20" />
      <div className="overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-slate-900/5">
        <Skeleton className="h-40 rounded-none sm:h-48" />
        <div className="grid grid-cols-3 gap-4 p-4 sm:p-6">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
          <Skeleton className="col-span-3 h-2 w-full rounded-full" />
        </div>
      </div>
      <div className="flex gap-6 border-b border-slate-200 pb-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-4 w-16" />
        ))}
      </div>
      <CardSkeleton />
    </div>
  )
}
