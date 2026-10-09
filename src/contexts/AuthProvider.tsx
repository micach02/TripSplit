import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import * as authService from '@/services/authService'
import * as profileService from '@/services/profileService'
import type { Profile, ProfileUpdate } from '@/types/models'

interface ProfileState {
  userId: string
  profile: Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [profileState, setProfileState] = useState<ProfileState | null>(null)

  useEffect(() => {
    // Fires INITIAL_SESSION right away, then on every sign-in/out and token refresh.
    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
      setSession(nextSession)
      setInitialized(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    profileService.ensureProfile().then(
      (profile) => {
        if (!cancelled) setProfileState({ userId, profile })
      },
      (error: unknown) => {
        if (import.meta.env.DEV) console.error('[TripSplit] Could not load profile', error)
        // Let the app render with fallbacks (name from email) rather than spin forever.
        if (!cancelled) setProfileState({ userId, profile: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const profile = await profileService.ensureProfile()
    setProfileState({ userId, profile })
  }, [userId])

  const updateProfile = useCallback(
    async (changes: ProfileUpdate) => {
      if (!userId) throw new Error('Not signed in')
      const profile = await profileService.updateProfile(userId, changes)
      setProfileState({ userId, profile })
      return profile
    },
    [userId],
  )

  const clearPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), [])

  // Ignore a profile that belongs to a previous session.
  const current = profileState?.userId === userId ? profileState : null
  const profile = current?.profile ?? null
  const status: AuthStatus = !initialized
    ? 'loading'
    : !userId
      ? 'unauthenticated'
      : current
        ? 'authenticated'
        : 'loading'

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      isPasswordRecovery,
      clearPasswordRecovery,
      refreshProfile,
      updateProfile,
      signOut: authService.signOut,
    }),
    [status, session, profile, isPasswordRecovery, clearPasswordRecovery, refreshProfile, updateProfile],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
