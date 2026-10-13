export type InvitationState = 'pending' | 'expired' | 'declined' | 'accepted'

const HOUR = 60 * 60 * 1000

/**
 * What an invitation means right now. The database keeps "pending" until
 * something replaces it, so a pending invitation past its expiry is expired.
 */
export function invitationState(
  invitation: { status: string; expires_at: string },
  now: Date = new Date(),
): InvitationState {
  if (invitation.status === 'pending') {
    return new Date(invitation.expires_at).getTime() > now.getTime() ? 'pending' : 'expired'
  }
  return invitation.status as InvitationState
}

/** "Expires in 6 days", "Expires in 5 hours", "Expired", plus whether it's nearly over. */
export function expiryLabel(expiresAt: string, now: Date = new Date()): { text: string; soon: boolean } {
  const left = new Date(expiresAt).getTime() - now.getTime()
  if (left <= 0) return { text: 'Expired', soon: true }
  const hours = Math.floor(left / HOUR)
  if (hours < 1) return { text: 'Expires in under an hour', soon: true }
  if (hours < 24) return { text: `Expires in ${hours} ${hours === 1 ? 'hour' : 'hours'}`, soon: true }
  const days = Math.round(hours / 24)
  return { text: days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`, soon: days <= 1 }
}

/** The message that goes with a shared invite link (Messenger, Viber, WhatsApp…). */
export function invitationMessage({
  inviterName,
  tripName,
  invitedName,
}: {
  inviterName: string | null | undefined
  tripName: string
  invitedName: string | null | undefined
}): string {
  const greeting = invitedName?.trim() ? `Hi ${invitedName.trim().split(/\s+/)[0]}! ` : ''
  const inviter = inviterName?.trim() || 'Your friend'
  return `${greeting}${inviter} invited you to join “${tripName}” on TripSplit so we can track and split our costs together. Tap the link to join:`
}
