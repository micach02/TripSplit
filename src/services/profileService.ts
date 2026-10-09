import { supabase } from '@/lib/supabase'
import type { Profile, ProfileUpdate } from '@/types/models'

/**
 * Returns the signed-in user's TripSplit profile, creating it on first use
 * (accounts may already exist from another app sharing the Supabase project).
 */
export async function ensureProfile(): Promise<Profile> {
  const { data, error } = await supabase.rpc('ensure_profile')
  if (error) throw error
  return data
}

export async function updateProfile(userId: string, changes: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(changes).eq('id', userId).select('*').single()
  if (error) throw error
  return data
}
