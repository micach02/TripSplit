import { useRouteError } from 'react-router'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Logo } from '@/components/ui/Logo'
import { paths } from '@/routes/paths'

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
  if (import.meta.env.DEV) console.error('[TripSplit] Route error', error)
  const stale = isStaleChunkError(error)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <title>Something went wrong · TripSplit</title>
      <Logo />
      <Card className="w-full max-w-md">
        <EmptyState
          icon={TriangleAlert}
          title={stale ? 'TripSplit has been updated' : 'Something went wrong'}
          description={
            stale
              ? 'Reload the page to get the latest version.'
              : 'An unexpected error stopped this page from loading. Reloading usually fixes it.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => window.location.reload()} icon={<RefreshCw className="size-4" aria-hidden />}>
                Reload
              </Button>
              {/* A full page load, in case the router itself is in a bad state */}
              <a href={paths.dashboard} className={buttonClasses({ variant: 'outline' })}>
                Go to dashboard
              </a>
            </div>
          }
        />
      </Card>
    </div>
  )
}
