import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { InvitationsContext } from '@/contexts/InvitationsContext'
import { useAsync } from '@/hooks/useAsync'
import { useDataChanged } from '@/lib/dataEvents'
import { getBudgetAlerts } from '@/services/alertsService'
import { getMyInvitations } from '@/services/memberService'
import { currentMonth } from '@/utils/budgetPeriod'

const RECHECK_MS = 2 * 60 * 1000
const DISMISSED_KEY = 'tripsplit:dismissed-alerts'

function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>): void {
  try {
    // Only this month's (and trips') dismissals matter; drop older ones.
    const month = currentMonth()
    const keep = [...ids].filter((id) => id.includes(`:${month}:`) || id.includes(':trip:'))
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(keep))
  } catch {
    // Remembering dismissals is a convenience only.
  }
}

/**
 * Everything behind the bell, loaded once for the app shell: invitations
 * (badge, dashboard banner, Notifications page) and budget alerts. It
 * re-checks when the tab regains focus and every couple of minutes while
 * visible; screens that change things call refresh().
 */
export function InvitationsProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, reload } = useAsync(getMyInvitations)
  const alerts = useAsync(getBudgetAlerts)
  const reloadAlerts = alerts.reload
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed)
  const loadedAt = useRef(0)

  useEffect(() => {
    if (data) loadedAt.current = Date.now()
  }, [data])

  const refresh = useCallback(() => {
    reload()
    reloadAlerts()
  }, [reload, reloadAlerts])
  // New spending can trip an alert
  useDataChanged(reloadAlerts)

  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', recheck)
    const timer = window.setInterval(recheck, RECHECK_MS)
    return () => {
      window.removeEventListener('focus', recheck)
      window.clearInterval(timer)
    }
  }, [refresh])

  const refreshIfStale = useCallback(
    (maxAgeMs: number) => {
      // A load already in flight will bring fresh data anyway.
      if (!loading && Date.now() - loadedAt.current > maxAgeMs) refresh()
    },
    [loading, refresh],
  )

  const dismissAlert = useCallback((id: string) => {
    setDismissed((current) => {
      const next = new Set(current).add(id)
      writeDismissed(next)
      return next
    })
  }, [])

  const visibleAlerts = useMemo(
    () => (alerts.data ?? []).filter((alert) => !dismissed.has(alert.id)),
    [alerts.data, dismissed],
  )

  const value = useMemo(
    () => ({
      invitations: data,
      error: data ? undefined : error,
      alerts: visibleAlerts,
      dismissAlert,
      count: (data?.length ?? 0) + visibleAlerts.length,
      refresh,
      refreshIfStale,
    }),
    [data, error, visibleAlerts, dismissAlert, refresh, refreshIfStale],
  )
  return <InvitationsContext value={value}>{children}</InvitationsContext>
}
