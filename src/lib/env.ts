/**
 * Public runtime configuration. Only the Supabase URL and the anon /
 * publishable key may ever reach the browser.
 */

/**
 * supabase-js wants the bare project URL (https://<ref>.supabase.co). The
 * dashboard also shows the REST endpoint (…/rest/v1), which is easy to paste
 * by mistake — accept it and strip the suffix.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, '')
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL ?? '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

/** True when the key is a service-role / secret key that must never ship to a browser. */
function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const [, payload] = key.split('.')
  if (!payload) return false
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }
    return claims.role === 'service_role'
  } catch {
    return false
  }
}

export type EnvProblem = 'missing' | 'invalid-url' | 'privileged-key'

function detectProblem(): EnvProblem | null {
  if (!supabaseUrl || !supabaseAnonKey) return 'missing'
  if (!isHttpUrl(supabaseUrl)) return 'invalid-url'
  if (isPrivilegedKey(supabaseAnonKey)) return 'privileged-key'
  return null
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  problem: detectProblem(),
} as const
