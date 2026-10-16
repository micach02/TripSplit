import { useState } from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/utils/format'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<AvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-24 text-3xl',
}

// Fallback colours, picked deterministically from the name.
const palette = [
  'bg-primary-100 text-primary-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-800',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-800',
]

function colorFor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return palette[Math.abs(hash) % palette.length]
}

interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: AvatarSize
  /** Hide from screen readers when the name is already shown next to the avatar. */
  decorative?: boolean
  className?: string
}

export function Avatar({ name, src, size = 'md', decorative = false, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && src !== failedSrc
  const label = decorative ? '' : (name ?? '')

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold select-none',
        sizes[size],
        !showImage && colorFor(name ?? ''),
        className,
      )}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={label}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      {!showImage && label && <span className="sr-only">{label}</span>}
    </span>
  )
}
