import { describe, expect, it } from 'vitest'
import { isInvitePath, redirectTarget } from '@/routes/redirect'

describe('redirectTarget', () => {
  it('rebuilds the path a signed-out visitor was heading to', () => {
    const state = { from: { pathname: '/invite/abc', search: '?x=1', hash: '#top' } }
    expect(redirectTarget(state)).toBe('/invite/abc?x=1#top')
  })

  it('works without search or hash', () => {
    expect(redirectTarget({ from: { pathname: '/trips/1' } })).toBe('/trips/1')
  })

  it('ignores missing or malformed state', () => {
    expect(redirectTarget(null)).toBeNull()
    expect(redirectTarget(undefined)).toBeNull()
    expect(redirectTarget({})).toBeNull()
    expect(redirectTarget({ from: 'nope' })).toBeNull()
    expect(redirectTarget({ from: { pathname: 42 } })).toBeNull()
  })

  it('never redirects off-site', () => {
    expect(redirectTarget({ from: { pathname: 'https://evil.example' } })).toBeNull()
    expect(redirectTarget({ from: { pathname: '//evil.example' } })).toBeNull()
  })
})

describe('isInvitePath', () => {
  it('recognises invite links only', () => {
    expect(isInvitePath('/invite/7a1c')).toBe(true)
    expect(isInvitePath('/trips/7a1c')).toBe(false)
    expect(isInvitePath(null)).toBe(false)
  })
})
