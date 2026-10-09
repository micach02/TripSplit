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
  notifications: '/notifications',
  profile: '/profile',
  settings: '/settings',
} as const

export type TripSection = 'expenses' | 'people' | 'balances' | 'settlements' | 'analytics' | 'settings'

/** /trips/:tripId or one of its tabs. */
export function tripPath(tripId: string, section?: TripSection): string {
  return section ? `/trips/${tripId}/${section}` : `/trips/${tripId}`
}

export function newExpensePath(tripId: string): string {
  return `/trips/${tripId}/expenses/new`
}

export function editExpensePath(tripId: string, expenseId: string): string {
  return `/trips/${tripId}/expenses/${expenseId}/edit`
}

export function invitePath(token: string): string {
  return `/invite/${token}`
}
