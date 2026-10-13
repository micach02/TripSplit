import { useSyncExternalStore } from 'react'
import { getResolvedTheme, getThemeChoice, setThemeChoice, subscribeTheme } from '@/lib/theme'

/** The saved light/dark choice, what it resolves to right now, and a setter. */
export function useTheme() {
  const choice = useSyncExternalStore(subscribeTheme, getThemeChoice)
  const resolved = useSyncExternalStore(subscribeTheme, getResolvedTheme)
  return { choice, resolved, setChoice: setThemeChoice }
}
