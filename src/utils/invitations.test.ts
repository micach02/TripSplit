import { describe, expect, it } from 'vitest'
import { invitationMessage } from '@/utils/invitations'

describe('invitationMessage', () => {
  it('greets the invitee by first name', () => {
    expect(invitationMessage({ inviterName: 'Ana Reyes', tripName: 'Siargao Surf Trip', invitedName: 'Ben Cruz' })).toBe(
      'Hi Ben! Ana Reyes invited you to join “Siargao Surf Trip” on TripSplit so we can track and split our trip costs. Tap the link to join:',
    )
  })

  it('skips the greeting without a name and falls back for a missing inviter', () => {
    const message = invitationMessage({ inviterName: '  ', tripName: 'Japan', invitedName: null })
    expect(message.startsWith('Your friend invited you to join “Japan”')).toBe(true)
  })
})
