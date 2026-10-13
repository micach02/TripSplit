/**
 * Every page is its own chunk (see lazyPages.ts), so the first visit to a
 * screen waits for its code. Once the signed-in app is idle, fetch the code for
 * the screens people use most, so moving around feels instant. Skipped when
 * the browser asks to save data or the connection is very slow. Analytics (the
 * charts library) is left to load on demand.
 */
export function prefetchCommonPages(): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return

  const load = () => {
    const pages = [
      import('@/pages/dashboard/DashboardPage'),
      import('@/pages/trips/TripsPage'),
      import('@/pages/trips/TripLayout'),
      import('@/pages/trips/TripOverviewPage'),
      import('@/pages/trips/TripExpensesPage'),
      import('@/pages/trips/TripBalancesPage'),
      import('@/pages/expenses/ExpenseFormPage'),
      import('@/pages/spending/MySpendingPage'),
    ]
    // A miss here is harmless: the page loads normally when visited.
    for (const page of pages) page.catch(() => undefined)
  }

  // Wait until the page being opened has had time to load its own data:
  // evaluating extra chunks earlier competes with it on slow phones.
  window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 3000 })
    else load()
  }, SETTLE_MS)
}

const SETTLE_MS = 5000
