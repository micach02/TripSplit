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
  return `${greeting}${inviter} invited you to join “${tripName}” on TripSplit so we can track and split our trip costs. Tap the link to join:`
}
