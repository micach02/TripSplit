import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-5 animate-spin', className)} aria-hidden />
}

/** Centered spinner for page content while a lazy route or data loads. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-blue-600" role="status">
      <Spinner className="size-7" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
