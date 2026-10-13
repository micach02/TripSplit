import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

const TITLE_WAIT_MS = 3000

/**
 * Single-page navigation is silent for screen readers. After each route change
 * this announces the new page's title (once the page has set it; lazy pages
 * take a moment) and moves focus to the main content — unless the page has
 * already focused something inside it, like the expense form's amount field.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation()
  const region = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      // The initial page load is announced by the browser itself.
      firstRender.current = false
      return
    }
    const previousTitle = document.title
    const started = Date.now()
    const timer = window.setInterval(() => {
      const changed = document.title !== previousTitle
      if (!changed && Date.now() - started < TITLE_WAIT_MS) return
      window.clearInterval(timer)
      if (region.current) region.current.textContent = document.title.replace(/ · TripSplit$/, '')
      const main = document.getElementById('main')
      if (main && main.tabIndex >= -1 && !main.contains(document.activeElement)) {
        main.focus({ preventScroll: true })
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [pathname])

  return <div ref={region} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
}
