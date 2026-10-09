import { describe, expect, it } from 'vitest'
import { normalizeSupabaseUrl } from './env'

describe('normalizeSupabaseUrl', () => {
  it('keeps a bare project URL', () => {
    expect(normalizeSupabaseUrl('https://abc123.supabase.co')).toBe('https://abc123.supabase.co')
  })

  it('strips the REST or Auth endpoint pasted from the dashboard', () => {
    expect(normalizeSupabaseUrl('https://abc123.supabase.co/rest/v1/')).toBe('https://abc123.supabase.co')
    expect(normalizeSupabaseUrl('https://abc123.supabase.co/rest/v1')).toBe('https://abc123.supabase.co')
    expect(normalizeSupabaseUrl('https://abc123.supabase.co/auth/v1')).toBe('https://abc123.supabase.co')
  })

  it('trims whitespace and trailing slashes', () => {
    expect(normalizeSupabaseUrl('  http://127.0.0.1:54321//  ')).toBe('http://127.0.0.1:54321')
  })
})
