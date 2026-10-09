import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

/** Renders child routes only for signed-in users; everyone else goes to /login. */
export function ProtectedRoute() {
  const { status, isPasswordRecovery } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'unauthenticated') return <Navigate to={paths.login} replace state={{ from: location }} />
  // A reset link that landed on the wrong page still ends up at the reset form.
  if (isPasswordRecovery) return <Navigate to={paths.resetPassword} replace />
  return <Outlet />
}
