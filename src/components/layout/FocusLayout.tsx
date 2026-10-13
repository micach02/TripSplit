import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { FullPageLoader } from '@/components/ui/FullPageLoader'

/** Full-screen task layout (no navigation chrome) — e.g. adding an expense on a phone. */
export function FocusLayout() {
  return (
    <main id="main" className="min-h-dvh bg-canvas">
      <Suspense fallback={<FullPageLoader />}>
        <Outlet />
      </Suspense>
    </main>
  )
}
