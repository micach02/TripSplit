import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { useAuth } from '@/hooks/useAuth'
import { readPendingInvite } from '@/lib/pendingInvite'
import { paths } from '@/routes/paths'

/** Renders child routes only for signed-in users; everyone else goes to /login. */
export function ProtectedRoute() {
  const { status, isPasswordRecovery, user, profile } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'unauthenticated') return <Navigate to={paths.login} replace state={{ from: location }} />
  // A reset link that landed on the wrong page still ends up at the reset form.
  if (isPasswordRecovery) return <Navigate to={paths.resetPassword} replace />
  // Back to an invite they opened before confirming their email (see lib/pendingInvite).
  const pendingInvite = readPendingInvite(user?.email)
  if (pendingInvite && location.pathname !== pendingInvite) return <Navigate to={pendingInvite} replace />
  // New accounts see the welcome steps once — but not on the way into an invite.
  const welcome = profile && profile.onboarded_at === null && location.pathname !== paths.welcome
  if (welcome && !location.pathname.startsWith('/invite/')) return <Navigate to={paths.welcome} replace />
  return <Outlet />
}
