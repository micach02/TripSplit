/**
 * Where the app is served from: '' in development, '/TripSplit' on GitHub Pages.
 * Comes from Vite's `base` (set by BASE_PATH at build time).
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '')

/** React Router basename. */
export const routerBasename = BASE || '/'

/** Full URL of an in-app path, for links opened outside the app (shared invites, auth emails). */
export function absoluteUrl(path: string): string {
  return new URL(`${BASE}${path}`, window.location.origin).toString()
}

export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  trips: '/trips',
  newTrip: '/trips/new',
  addExpense: '/expenses/new',
  activity: '/activity',
  spending: '/spending',
  search: '/search',
  notifications: '/notifications',
  profile: '/profile',
  settings: '/settings',
  welcome: '/welcome',
  privacy: '/privacy',
  terms: '/terms',
} as const

export type TripSection = 'expenses' | 'people' | 'balances' | 'analytics' | 'settings'

/** /trips/:tripId or one of its tabs. */
export function tripPath(tripId: string, section?: TripSection): string {
  return section ? `/trips/${tripId}/${section}` : `/trips/${tripId}`
}

/** The create page with "Monthly budget" chosen */
export const newBudgetPath = `${paths.newTrip}?kind=budget`

export function newExpensePath(tripId: string): string {
  return `/trips/${tripId}/expenses/new`
}

export function editExpensePath(tripId: string, expenseId: string): string {
  return `/trips/${tripId}/expenses/${expenseId}/edit`
}

export function invitePath(token: string): string {
  return `/invite/${token}`
}

/**
 * The link people share. It opens the app's root (`/?invite=…`), which GitHub
 * Pages serves with a 200 — chat apps only show a preview card for those, not
 * for the 404 fallback that deep links like /invite/… get. The root forwards
 * to invitePath.
 */
export function inviteShareUrl(token: string): string {
  return absoluteUrl(`/?invite=${token}`)
}
