import { Outlet, ScrollRestoration } from 'react-router'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { RouteAnnouncer } from '@/components/layout/RouteAnnouncer'

export function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <RouteAnnouncer />
      <OfflineBanner />
      <Outlet />
    </>
  )
}
