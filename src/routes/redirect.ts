/**
 * Where a signed-out visitor was heading. <ProtectedRoute> stores the location
 * in router state as `from`; login and register pass it along so an invite link
 * still works after signing in or creating an account.
 */
export function redirectTarget(state: unknown): string | null {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)?.from
  const pathname = from?.pathname
  // Same-site paths only ("//host" would leave the app).
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) return null
  const search = typeof from?.search === 'string' ? from.search : ''
  const hash = typeof from?.hash === 'string' ? from.hash : ''
  return `${pathname}${search}${hash}`
}

export function isInvitePath(path: string | null): boolean {
  return path !== null && path.startsWith('/invite/')
}
