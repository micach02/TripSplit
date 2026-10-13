/**
 * Remembers an invite link someone opened before they had an account, so it
 * survives email confirmation. The confirmation email can land on another page,
 * or (if the redirect URL isn't allow-listed in Supabase) on another site. The
 * next time that same person is signed in to TripSplit on this device, they're
 * taken back to the invite.
 *
 * Tied to the email they signed up or logged in with, so someone else using the
 * same browser isn't sent to it. Kept for 7 days, like the invitation itself.
 */
const KEY = 'tripsplit:pending-invite'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface Stored {
  path: string
  email: string
  savedAt: number
}

export function savePendingInvite(path: string, email: string): void {
  try {
    const value: Stored = { path, email: email.trim().toLowerCase(), savedAt: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode): the redirect URL is the main path anyway.
  }
}

/** The remembered invite path for this user, if any. */
export function readPendingInvite(email: string | null | undefined): string | null {
  if (!email) return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<Stored>
    const fresh = typeof stored.savedAt === 'number' && Date.now() - stored.savedAt < MAX_AGE_MS
    const valid = typeof stored.path === 'string' && stored.path.startsWith('/invite/')
    if (!fresh || !valid) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return stored.email === email.trim().toLowerCase() ? (stored.path ?? null) : null
  } catch {
    return null
  }
}

/** Forgets the remembered invite (only if it's `path`, when given). */
export function clearPendingInvite(path?: string): void {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return
    if (path && (JSON.parse(raw) as Partial<Stored>).path !== path) return
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
