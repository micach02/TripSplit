import { Navigate, useSearchParams } from 'react-router'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { useAuth } from '@/hooks/useAuth'
import { LandingPage } from '@/routes/lazyPages'
import { invitePath, paths } from '@/routes/paths'

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * "/": shared invite links (/?invite=…) go to the invite; signed-in people go
 * to their dashboard; everyone else gets the landing page.
 */
export function HomeRoute() {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  const invite = searchParams.get('invite')

  if (invite && TOKEN.test(invite)) return <Navigate to={invitePath(invite)} replace />
  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') return <Navigate to={paths.dashboard} replace />
  return <LandingPage />
}
