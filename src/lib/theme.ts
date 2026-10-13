/**
 * Light or dark mode. The choice is saved on this device; "system" follows the
 * phone or computer setting. The resolved theme lives on <html data-theme>,
 * which index.html sets before the first paint and the CSS keys off.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

// Also read by the inline script in index.html: keep the two in step.
const STORAGE_KEY = 'tripsplit:theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

let choice = readChoice()

function apply(): void {
  const resolved: ResolvedTheme = choice === 'system' ? (darkQuery.matches ? 'dark' : 'light') : choice
  if (document.documentElement.dataset.theme !== resolved) document.documentElement.dataset.theme = resolved
  for (const listener of listeners) listener()
}

darkQuery.addEventListener('change', () => {
  if (choice === 'system') apply()
})

// Another tab changed the setting.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  choice = readChoice()
  apply()
})

export function getThemeChoice(): ThemeChoice {
  return choice
}

export function getResolvedTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setThemeChoice(next: ThemeChoice): void {
  choice = next
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Private mode: the choice lasts until the tab closes.
  }
  apply()
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

apply()
