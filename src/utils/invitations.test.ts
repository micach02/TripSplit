import { describe, expect, it } from 'vitest'
import { expiryLabel, invitationMessage, invitationState } from '@/utils/invitations'

const now = new Date('2026-10-09T12:00:00Z')
const inHours = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()

describe('invitationState', () => {
  it('treats a pending invitation past its expiry as expired', () => {
    expect(invitationState({ status: 'pending', expires_at: inHours(5) }, now)).toBe('pending')
    expect(invitationState({ status: 'pending', expires_at: inHours(-1) }, now)).toBe('expired')
    expect(invitationState({ status: 'pending', expires_at: now.toISOString() }, now)).toBe('expired')
  })

  it('keeps answered statuses as they are', () => {
    expect(invitationState({ status: 'declined', expires_at: inHours(5) }, now)).toBe('declined')
    expect(invitationState({ status: 'accepted', expires_at: inHours(-5) }, now)).toBe('accepted')
    expect(invitationState({ status: 'expired', expires_at: inHours(-5) }, now)).toBe('expired')
  })
})

describe('expiryLabel', () => {
  it('counts days for a fresh invitation', () => {
    expect(expiryLabel(inHours(7 * 24), now)).toEqual({ text: 'Expires in 7 days', soon: false })
    expect(expiryLabel(inHours(2 * 24 + 3), now)).toEqual({ text: 'Expires in 2 days', soon: false })
  })

  it('warns as the end gets close', () => {
    expect(expiryLabel(inHours(30), now)).toEqual({ text: 'Expires in 1 day', soon: true })
    expect(expiryLabel(inHours(5.5), now)).toEqual({ text: 'Expires in 5 hours', soon: true })
    expect(expiryLabel(inHours(1), now)).toEqual({ text: 'Expires in 1 hour', soon: true })
    expect(expiryLabel(inHours(0.25), now)).toEqual({ text: 'Expires in under an hour', soon: true })
  })

  it('says expired once the time is up', () => {
    expect(expiryLabel(inHours(-2), now)).toEqual({ text: 'Expired', soon: true })
  })
})

describe('invitationMessage', () => {
  it('greets the invitee by first name', () => {
    expect(invitationMessage({ inviterName: 'Ana Reyes', tripName: 'Siargao Surf Trip', invitedName: 'Ben Cruz' })).toBe(
      'Hi Ben! Ana Reyes invited you to join “Siargao Surf Trip” on TripSplit so we can track and split our costs together. Tap the link to join:',
    )
  })

  it('skips the greeting without a name and falls back for a missing inviter', () => {
    const message = invitationMessage({ inviterName: '  ', tripName: 'Japan', invitedName: null })
    expect(message.startsWith('Your friend invited you to join “Japan”')).toBe(true)
  })
})
