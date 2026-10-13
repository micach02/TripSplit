import { Plane } from 'lucide-react'
import { cn } from '@/lib/cn'

// Static class names so Tailwind can see them.
const gradients = [
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-violet-400 to-indigo-600',
  'from-amber-300 to-orange-500',
  'from-pink-400 to-fuchsia-600',
  'from-cyan-400 to-sky-600',
]

function gradientFor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return gradients[Math.abs(hash) % gradients.length]
}

interface TripCoverProps {
  tripId: string
  name: string
  url: string | null
  className?: string
  /** Large covers get a bigger watermark icon. */
  size?: 'card' | 'banner'
}

/** The trip's photo, or a colourful gradient picked from its id. */
export function TripCover({ tripId, name, url, className, size = 'card' }: TripCoverProps) {
  return (
    <div className={cn('relative overflow-hidden bg-slate-200', className)}>
      {url ? (
        // The banner is the biggest thing on a trip page: load it straight away, not lazily.
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          loading={size === 'banner' ? 'eager' : 'lazy'}
          fetchPriority={size === 'banner' ? 'high' : 'auto'}
          decoding="async"
        />
      ) : (
        <div
          className={cn('flex size-full items-center justify-center bg-linear-to-br text-white', gradientFor(tripId))}
          aria-hidden
        >
          <Plane className={cn('-rotate-12 opacity-30', size === 'banner' ? 'size-24' : 'size-12')} strokeWidth={1.5} />
        </div>
      )}
      <span className="sr-only">{`Cover for ${name}`}</span>
    </div>
  )
}
