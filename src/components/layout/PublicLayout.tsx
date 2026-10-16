import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

/** The landing page and legal pages: open to everyone, signed in or not. */
export function PublicLayout() {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={paths.home} className="rounded-lg" aria-label="TripSplit home">
            <Logo />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            {signedIn ? (
              <ButtonLink to={paths.dashboard} size="sm">
                Open TripSplit
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to={paths.login} size="sm" variant="ghost">
                  Log in
                </ButtonLink>
                <ButtonLink to={paths.register} size="sm">
                  Sign up free
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
