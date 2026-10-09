import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * TripSplit keeps all its tables in the `tripsplit` schema so it can share a
 * Supabase project with another app. The schema must be listed under
 * Project Settings → Data API → Exposed schemas.
 */
export const DB_SCHEMA = 'tripsplit'

// When configuration is missing, main.tsx renders a setup screen instead of
// the app, so the placeholder values below are never used for requests.
export const supabase = createClient<Database, typeof DB_SCHEMA>(
  env.problem ? 'http://localhost:54321' : env.supabaseUrl,
  env.problem ? 'missing-key' : env.supabaseAnonKey,
  {
    db: { schema: DB_SCHEMA },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Implicit flow lets confirmation and password-reset links work even when
      // they're opened on a different device or browser than the request.
      flowType: 'implicit',
    },
  },
)
