import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'
import { redirectTarget } from '@/routes/redirect'

/** Login/register screens: signed-in users are sent on to where they were going. */
export function PublicOnlyRoute() {
  const { status, isPasswordRecovery } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') {
    if (isPasswordRecovery) return <Navigate to={paths.resetPassword} replace />
    return <Navigate to={redirectTarget(location.state) ?? paths.dashboard} replace />
  }
  return <Outlet />
}
