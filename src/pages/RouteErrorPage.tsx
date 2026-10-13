import { useRouteError } from 'react-router'
import { RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Logo } from '@/components/ui/Logo'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { absoluteUrl, paths } from '@/routes/paths'

/** A lazy route chunk that no longer exists — usually because a new version was deployed. */
function isStaleChunkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|importing a module script failed|failed to fetch dynamically/i.test(error.message)
  )
}

/** Last-resort screen for errors thrown while rendering a route. Never shows raw error text. */
export default function RouteErrorPage() {
  const error = useRouteError()
  const online = useOnlineStatus()
  if (import.meta.env.DEV) console.error('[TripSplit] Route error', error)
  // A page that couldn't be downloaded while offline isn't an update or a bug.
  const offline = !online && isStaleChunkError(error)
  const stale = online && isStaleChunkError(error)

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <title>{offline ? 'You’re offline · TripSplit' : 'Something went wrong · TripSplit'}</title>
      <Logo />
      <Card className="w-full max-w-md">
        <EmptyState
          headingLevel={1}
          icon={offline ? WifiOff : TriangleAlert}
          title={offline ? 'You’re offline' : stale ? 'TripSplit has been updated' : 'Something went wrong'}
          description={
            offline
              ? 'This page needs a connection to load. Reconnect, then try again.'
              : stale
                ? 'Reload the page to get the latest version.'
                : 'An unexpected error stopped this page from loading. Reloading usually fixes it.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => window.location.reload()} icon={<RefreshCw className="size-4" aria-hidden />}>
                Reload
              </Button>
              {/* A full page load, in case the router itself is in a bad state */}
              <a href={absoluteUrl(paths.dashboard)} className={buttonClasses({ variant: 'outline' })}>
                Go to dashboard
              </a>
            </div>
          }
        />
      </Card>
    </main>
  )
}
