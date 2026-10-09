import { describe, expect, it } from 'vitest'
import { collectErrors, validateEmail, validateFullName, validatePassword, validatePasswordConfirmation } from './validation'

describe('validateEmail', () => {
  it('accepts normal addresses', () => {
    expect(validateEmail('michael@tripsplit.dev')).toBeNull()
    expect(validateEmail('  anna.tan+trips@example.com ')).toBeNull()
  })

  it('rejects empty and malformed addresses', () => {
    expect(validateEmail('')).toBe('Enter your email address.')
    expect(validateEmail('michael@')).toBe('Enter a valid email address.')
    expect(validateEmail('michael tripsplit.dev')).toBe('Enter a valid email address.')
  })
})

describe('validatePassword', () => {
  it('requires 8+ characters with letters and digits', () => {
    expect(validatePassword('tripsplit123')).toBeNull()
    expect(validatePassword('')).toBe('Enter a password.')
    expect(validatePassword('abc12')).toBe('Use at least 8 characters.')
    expect(validatePassword('abcdefgh')).toBe('Use both letters and numbers.')
    expect(validatePassword('12345678')).toBe('Use both letters and numbers.')
  })

  it('checks confirmation', () => {
    expect(validatePasswordConfirmation('tripsplit123', 'tripsplit123')).toBeNull()
    expect(validatePasswordConfirmation('tripsplit123', 'tripsplit124')).toBe("Passwords don't match.")
  })
})

describe('validateFullName', () => {
  it('requires a non-blank name', () => {
    expect(validateFullName('Sarah Lim')).toBeNull()
    expect(validateFullName('   ')).toBe('Enter your name.')
    expect(validateFullName('x'.repeat(101))).toBe('Keep your name under 100 characters.')
  })
})

describe('collectErrors', () => {
  it('returns null when everything is valid', () => {
    expect(collectErrors({ email: null, password: null })).toBeNull()
  })

  it('keeps only the failing fields', () => {
    expect(collectErrors({ email: 'Bad', password: null })).toEqual({ email: 'Bad' })
  })
})
