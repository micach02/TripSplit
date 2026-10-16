import type { TripKind } from '@/utils/tripKind'

// Travel colours (sunset, lagoon, ocean, dusk…). Static class names so Tailwind
// can see them; 300–500 stops only, so dark mode keeps them vivid.
const gradients = [
  'from-amber-400 via-orange-400 to-rose-500', // sunset
  'from-emerald-400 to-teal-500', // lagoon
  'from-cyan-400 to-primary-500', // ocean
  'from-violet-400 via-fuchsia-400 to-coral-400', // dusk
  'from-amber-300 to-coral-400', // sand
  'from-pink-400 to-coral-500', // flamingo
  'from-sky-400 to-indigo-500', // sky
]

/** A budget's or trip's own gradient, picked from its id, so it's the same everywhere. */
export function coverGradient(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return gradients[Math.abs(hash) % gradients.length]
}

/** The emoji shown when there's no cover photo. */
export function coverEmoji(kind: TripKind): string {
  return kind === 'budget' ? '🧺' : '🏝️'
}
