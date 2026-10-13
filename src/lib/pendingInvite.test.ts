import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPendingInvite, readPendingInvite, savePendingInvite } from '@/lib/pendingInvite'

// Vitest runs in Node: give the module a minimal window.localStorage.
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('pending invite', () => {
  it('is returned to the same person, whatever the email casing', () => {
    savePendingInvite('/invite/abc', 'Ben@Example.com ')
    expect(readPendingInvite('ben@example.com')).toBe('/invite/abc')
  })

  it('is not handed to someone else on the same device', () => {
    savePendingInvite('/invite/abc', 'ben@example.com')
    expect(readPendingInvite('cara@example.com')).toBeNull()
    expect(readPendingInvite(null)).toBeNull()
  })

  it('is forgotten after 7 days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    savePendingInvite('/invite/abc', 'ben@example.com')
    vi.setSystemTime(new Date('2026-10-08T00:00:01Z'))
    expect(readPendingInvite('ben@example.com')).toBeNull()
  })

  it('only remembers invite paths', () => {
    savePendingInvite('/trips/123', 'ben@example.com')
    expect(readPendingInvite('ben@example.com')).toBeNull()
  })

  it('is cleared by its own invite page only', () => {
    savePendingInvite('/invite/abc', 'ben@example.com')
    clearPendingInvite('/invite/other')
    expect(readPendingInvite('ben@example.com')).toBe('/invite/abc')
    clearPendingInvite('/invite/abc')
    expect(readPendingInvite('ben@example.com')).toBeNull()
  })
})
