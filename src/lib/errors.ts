/**
 * Turns anything thrown by Supabase (auth, PostgREST, storage) or the network
 * into short, friendly copy. Raw database/API messages are never shown to users;
 * in development the original error is logged to the console instead.
 */

export const GENERIC_ERROR = 'Something went wrong. Please try again.'
const NETWORK_ERROR = "Can't reach TripSplit right now. Check your connection and try again."

/** Message keys raised by TripSplit's database triggers (errcode P0001). */
const DATABASE_RULES: Record<string, string> = {
  amount_precision: 'That amount has too many decimal places for its currency.',
  already_member: 'That person is already on this trip.',
  payer_not_member: 'The person who paid must be a member of this trip.',
  participant_not_member: 'Everyone in the split must be a member of this trip.',
  expense_requires_participant: 'Choose at least one person to share this expense.',
  split_total_mismatch: "The split doesn't add up to the expense total.",
  settlement_party_not_member: 'Both people in a settlement must be members of this trip.',
  trip_currency_locked: "The trip currency can't change once expenses or settlements are recorded.",
  trip_not_found: 'This trip no longer exists.',
  not_authenticated: 'Your session has expired. Please log in again.',
  not_permitted: "You don't have permission to do that.",
  member_has_activity:
    'This person has expenses or settlements on this trip, so they can’t be removed. Their history must stay intact.',
  invitation_not_found: 'This invitation isn’t for your account, or it no longer exists.',
  invitation_not_pending: 'This invitation has already been answered.',
  invitation_expired: 'This invitation has expired. Ask the trip owner to send a new one.',
  invitation_already_pending: 'This person already has a newer invitation waiting. Share that one instead.',
  invalid_split: 'Use one split method for the whole expense.',
  split_percentage_total: 'Percentages must add up to 100%.',
  split_custom_total: 'The amounts must add up to the total.',
  invalid_split_value: 'Give everyone in the split at least one share.',
  expense_not_editable: 'Only the person who added or paid for this expense, or the trip owner, can change it.',
  category_in_use: 'This category is used by expenses. Move them to another category first.',
  invalid_receipt_path: 'That receipt belongs to a different expense.',
  invalid_exchange_rate: 'Enter an exchange rate greater than zero.',
  unsupported_currency: 'That currency isn’t supported yet.',
}

const AUTH_CODES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email first — check your inbox for the link.',
  user_already_exists: 'An account with this email already exists. Try logging in instead.',
  email_exists: 'An account with this email already exists. Try logging in instead.',
  weak_password: 'Choose a stronger password: at least 8 characters with letters and numbers.',
  same_password: 'Your new password must be different from your current one.',
  email_address_invalid: 'Please enter a valid email address.',
  validation_failed: 'Please check the details you entered.',
  over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  signup_disabled: 'New sign-ups are currently disabled.',
  email_provider_disabled: 'Email sign-in is currently disabled.',
  session_not_found: 'Your session has expired. Please log in again.',
  session_expired: 'Your session has expired. Please log in again.',
  refresh_token_not_found: 'Your session has expired. Please log in again.',
  reauthentication_needed: 'For your security, please log in again before changing your password.',
  user_not_found: "We couldn't find that account.",
}

const POSTGRES_CODES: Record<string, string> = {
  '23505': 'That already exists.',
  '23503': "This item is linked to other records, so it can't be changed that way.",
  '23514': 'Some of the values entered are not allowed.',
  '23502': 'Please fill in all required fields.',
  '22P02': 'Some of the values entered are not valid.',
  '42501': "You don't have permission to do that.",
  PGRST116: "We couldn't find what you were looking for.",
  // Schema not exposed / function missing: the database hasn't been set up for TripSplit
  PGRST106: "TripSplit's database isn't set up on this Supabase project yet.",
  PGRST202: "TripSplit's database isn't set up on this Supabase project yet.",
  PGRST205: "TripSplit's database isn't set up on this Supabase project yet.",
  PGRST301: 'Your session has expired. Please log in again.',
}

interface ErrorLike {
  name?: unknown
  message?: unknown
  code?: unknown
  status?: unknown
  statusCode?: unknown
}

function isNetworkFailure(error: ErrorLike): boolean {
  if (error.name === 'AuthRetryableFetchError') return true
  const message = typeof error.message === 'string' ? error.message : ''
  return /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(message)
}

export function getErrorMessage(error: unknown, fallback: string = GENERIC_ERROR): string {
  if (import.meta.env.DEV) console.error('[TripSplit]', error)

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return NETWORK_ERROR
  if (!error || typeof error !== 'object') return fallback

  const e = error as ErrorLike
  if (isNetworkFailure(e)) return NETWORK_ERROR

  const code = typeof e.code === 'string' ? e.code : undefined
  const message = typeof e.message === 'string' ? e.message : undefined

  // Database trigger/RPC keys, and the app's own error classes that reuse them
  if ((code === undefined || code === 'P0001' || code === '42501') && message && DATABASE_RULES[message]) {
    return DATABASE_RULES[message]
  }
  if (code && AUTH_CODES[code]) return AUTH_CODES[code]
  if (code && POSTGRES_CODES[code]) return POSTGRES_CODES[code]

  // Storage errors carry an HTTP-ish status instead of a code
  const status = String(e.statusCode ?? e.status ?? '')
  if (status === '413') return 'That file is too large.'
  if (status === '415') return "That file type isn't supported."
  if (status === '401' || status === '403') return "You don't have permission to do that."
  if (status === '429') return 'Too many attempts. Please wait a moment and try again.'

  return fallback
}
