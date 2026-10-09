import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** For screens behind <ProtectedRoute>, where a user is guaranteed. */
export function useCurrentUser() {
  const { user, profile } = useAuth()
  if (!user) throw new Error('useCurrentUser must be used behind <ProtectedRoute>')
  return {
    user,
    profile,
    displayName: profile?.full_name || (user.user_metadata.full_name as string | undefined) || user.email || 'Traveler',
  }
}
