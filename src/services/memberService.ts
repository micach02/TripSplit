import { supabase } from '@/lib/supabase'
import { absoluteUrl, invitePath } from '@/routes/paths'
import type { TripInvitation } from '@/types/models'

/** Thrown when RLS silently filtered out a delete/update the user wasn't allowed to make. */
export class NotPermittedError extends Error {
  readonly code = '42501'
  constructor() {
    super('not_permitted')
    this.name = 'NotPermittedError'
  }
}

/** Removes a member (owners) or leaves the trip (yourself). Blocked for members with expenses. */
export async function removeMember(tripId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}

export async function inviteToTrip(tripId: string, email: string, name: string): Promise<TripInvitation> {
  const { data, error } = await supabase
    .from('trip_invitations')
    .insert({ trip_id: tripId, invited_email: email.trim().toLowerCase(), invited_name: name.trim() || null })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Pending, unexpired invitations for a trip (visible to its members). */
export async function listPendingInvitations(tripId: string): Promise<TripInvitation[]> {
  const { data, error } = await supabase
    .from('trip_invitations')
    .select('*')
    .eq('trip_id', tripId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { data, error } = await supabase.from('trip_invitations').delete().eq('id', invitationId).select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}

export interface MyInvitation {
  id: string
  tripId: string
  tripName: string
  destination: string | null
  startDate: string
  endDate: string
  invitedByName: string
  invitedByAvatarUrl: string | null
  expiresAt: string
}

/** Invitations waiting for the signed-in user. */
export async function getMyInvitations(): Promise<MyInvitation[]> {
  const { data, error } = await supabase.rpc('get_my_invitations')
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    tripId: row.trip_id,
    tripName: row.trip_name,
    destination: row.destination ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    invitedByName: row.invited_by_name ?? 'Someone',
    invitedByAvatarUrl: row.invited_by_avatar_url ?? null,
    expiresAt: row.expires_at,
  }))
}

/** Joins the trip; returns its id. */
export async function acceptInvitation(invitationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invitation', { p_invitation_id: invitationId })
  if (error) throw error
  return data
}

/** The shareable link for an invitation. */
export function invitationLink(token: string): string {
  return absoluteUrl(invitePath(token))
}

export interface InvitationPreview {
  tripId: string
  tripName: string
  destination: string | null
  startDate: string
  endDate: string
  invitedByName: string
  invitedByAvatarUrl: string | null
  invitedName: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  alreadyMember: boolean
}

/** What an invite link shows before joining; null when the link is unknown. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc('get_invitation_preview', { p_token: token })
  if (error) throw error
  const row = data[0]
  if (!row) return null
  return {
    tripId: row.trip_id,
    tripName: row.trip_name,
    destination: row.destination ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    invitedByName: row.invited_by_name ?? 'Someone',
    invitedByAvatarUrl: row.invited_by_avatar_url ?? null,
    invitedName: row.invited_name ?? null,
    status: row.status as InvitationPreview['status'],
    alreadyMember: row.already_member,
  }
}

/** Joins through an invite link; returns the trip id. */
export async function acceptInvitationLink(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invitation_link', { p_token: token })
  if (error) throw error
  return data
}

export async function declineInvitationLink(token: string): Promise<void> {
  const { error } = await supabase.rpc('decline_invitation_link', { p_token: token })
  if (error) throw error
}

export async function declineInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_invitation', { p_invitation_id: invitationId })
  if (error) throw error
}
