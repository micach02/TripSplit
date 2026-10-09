import { supabase } from '@/lib/supabase'
import { absoluteUrl as appUrl, paths } from '@/routes/paths'

export interface SignUpInput {
  fullName: string
  email: string
  password: string
  /** In-app path the confirmation email links back to */
  redirectPath?: string
}

/** Creates an account. The profile row is created by `ensure_profile()` from `full_name`. */
export async function signUp({
  fullName,
  email,
  password,
  redirectPath = paths.dashboard,
}: SignUpInput): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: appUrl(redirectPath),
    },
  })
  if (error) throw error
  return { needsEmailConfirmation: !data.session }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}

/** Signs out on this device only. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: appUrl(paths.resetPassword),
  })
  if (error) throw error
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
