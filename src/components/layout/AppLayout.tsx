import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router'
import { BackgroundTasks } from '@/components/layout/BackgroundTasks'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { InvitationsProvider } from '@/contexts/InvitationsProvider'
import { prefetchCommonPages } from '@/routes/prefetch'

/** Signed-in shell: sidebar on desktop, header + bottom tab bar on mobile. */
export function AppLayout() {
  useEffect(() => {
    prefetchCommonPages()
  }, [])

  return (
    <InvitationsProvider>
      <BackgroundTasks />
      <div className="min-h-dvh">
        <a
          href="#main"
          className="sr-only rounded-lg bg-surface px-4 py-2 font-semibold text-primary-700 shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        <Sidebar />
        <MobileHeader />
        <main id="main" tabIndex={-1} className="focus:outline-none lg:pl-64">
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <MobileTabBar />
      </div>
    </InvitationsProvider>
  )
}
