/**
 * The last copy of what you need without signal: each trip's details (members,
 * categories) for logging expenses, your list of budgets and trips, and the
 * dashboard. Kept in localStorage; used only when the network is unavailable.
 */

const PREFIX = 'tripsplit:offline:'

export function cacheSet(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }))
  } catch {
    // Storage full or blocked: offline use is a bonus, never required.
  }
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? ((JSON.parse(raw) as { value: T }).value ?? null) : null
  } catch {
    return null
  }
}

/** Forget everything (e.g. on sign-out, so the next person on this device can't see it). */
export function cacheClear(): void {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key)
    }
  } catch {
    // Nothing to clear.
  }
}

/** True for "can't reach the server" failures, as opposed to the server saying no. */
export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? '')
  return /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(message)
}
