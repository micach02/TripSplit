import { describe, expect, it } from 'vitest'
import { GENERIC_ERROR, getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('maps database rule keys to friendly copy', () => {
    expect(getErrorMessage({ code: 'P0001', message: 'split_total_mismatch' })).toBe(
      "The split doesn't add up to the expense total.",
    )
    expect(getErrorMessage({ code: '42501', message: 'expense_not_editable' })).toMatch(/Only the person/)
  })

  it('maps the app’s own error classes by message key', () => {
    expect(getErrorMessage(new Error('trip_not_found'))).toBe('This trip no longer exists.')
  })

  it('maps auth error codes', () => {
    expect(getErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Incorrect email or password.',
    )
  })

  it('explains a schema that is not set up yet', () => {
    expect(getErrorMessage({ code: 'PGRST106', message: 'Invalid schema: tripsplit' })).toMatch(/isn't set up/)
  })

  it('never leaks raw database messages', () => {
    expect(getErrorMessage({ code: 'XX000', message: 'relation "tripsplit.secret" does not exist' })).toBe(
      GENERIC_ERROR,
    )
    expect(getErrorMessage(new Error('duplicate key value violates unique constraint "x"'))).toBe(GENERIC_ERROR)
  })

  it('recognises network failures', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toMatch(/connection/)
  })
})
