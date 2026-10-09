import { LogoMark } from '@/components/ui/Logo'
import { Spinner } from '@/components/ui/Spinner'

/** Shown while the session is being restored on first load. */
export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5" role="status">
      <LogoMark className="size-12 rounded-2xl" />
      <Spinner className="size-6 text-blue-600" />
      <span className="sr-only">Loading TripSplit…</span>
    </div>
  )
}
