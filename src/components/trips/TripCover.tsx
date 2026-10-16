import { cn } from '@/lib/cn'
import { coverEmoji, coverGradient } from '@/utils/coverStyle'
import type { TripKind } from '@/utils/tripKind'

interface TripCoverProps {
  tripId: string
  name: string
  url: string | null
  className?: string
  /** Large covers get a bigger emoji. */
  size?: 'card' | 'banner'
  /** Picks the emoji shown without a photo */
  kind?: TripKind
}

/** The trip's photo, or its own colourful gradient with a playful emoji. */
export function TripCover({ tripId, name, url, className, size = 'card', kind = 'trip' }: TripCoverProps) {
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
          className={cn(
            'flex size-full bg-linear-to-br',
            // Banners carry the title at the bottom-left, so the emoji keeps to the top-right corner.
            size === 'banner' ? 'items-start justify-end p-4 sm:p-6' : 'items-center justify-center',
            coverGradient(tripId),
          )}
          aria-hidden
        >
          <span className={cn('-rotate-6 drop-shadow-md', size === 'banner' ? 'text-6xl sm:text-7xl' : 'text-5xl')}>{coverEmoji(kind)}</span>
        </div>
      )}
      <span className="sr-only">{`Cover for ${name}`}</span>
    </div>
  )
}
