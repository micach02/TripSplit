/**
 * Form validators. Each returns an error message, or null when the value is valid.
 * Password rules mirror supabase/config.toml (min 8 chars, letters + digits) —
 * keep the hosted project's Auth settings in sync.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_HINT = 'At least 8 characters, with letters and numbers.'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): string | null {
  const value = email.trim()
  if (!value) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address.'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.'
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return 'Use both letters and numbers.'
  return null
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Confirm your password.'
  if (password !== confirmation) return "Passwords don't match."
  return null
}

export function validateFullName(name: string): string | null {
  const value = name.trim()
  if (!value) return 'Enter your name.'
  if (value.length > 100) return 'Keep your name under 100 characters.'
  return null
}

export type FieldErrors<T extends string> = Partial<Record<T, string>>

/** Drops null entries; returns null when every field is valid. */
export function collectErrors<T extends string>(checks: Record<T, string | null>): FieldErrors<T> | null {
  const errors: FieldErrors<T> = {}
  let hasError = false
  for (const key of Object.keys(checks) as T[]) {
    const message = checks[key]
    if (message) {
      errors[key] = message
      hasError = true
    }
  }
  return hasError ? errors : null
}
