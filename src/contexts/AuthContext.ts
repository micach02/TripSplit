import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, ProfileUpdate } from '@/types/models'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  /** 'loading' until the session is known and, when signed in, the profile has loaded. */
  status: AuthStatus
  session: Session | null
  user: User | null
  /** Null while loading, or if the profile could not be fetched. */
  profile: Profile | null
  /** True after arriving through a password-reset link, until a new password is set. */
  isPasswordRecovery: boolean
  clearPasswordRecovery: () => void
  refreshProfile: () => Promise<void>
  updateProfile: (changes: ProfileUpdate) => Promise<Profile>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
