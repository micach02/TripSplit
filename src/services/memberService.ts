import { supabase } from '@/lib/supabase'
import { absoluteUrl, invitePath } from '@/routes/paths'
import type { TripInvitation } from '@/types/models'
import { invitationState, type InvitationState } from '@/utils/invitations'
import type { TripKind } from '@/utils/tripKind'

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

/** Adds someone by name (no account needed); returns their id, used like any member's. */
export async function addPerson(tripId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_trip_person', { p_trip_id: tripId, p_name: name })
  if (error) throw error
  return data
}

/**
 * Adds several people by name, one at a time so a clash (e.g. a name already
 * there) doesn't stop the rest. Returns the names that couldn't be added.
 */
export async function addPeople(tripId: string, names: readonly string[]): Promise<string[]> {
  const failed: string[] = []
  for (const name of names) {
    try {
      await addPerson(tripId, name)
    } catch {
      failed.push(name)
    }
  }
  return failed
}

/** The owner, or whoever added them, can rename someone added by name. */
export async function renamePerson(personId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_trip_person', { p_person_id: personId, p_name: name })
  if (error) throw error
}

/** Removes someone added by name (refused once they have expenses or settlements). */
export async function removePerson(personId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_trip_person', { p_person_id: personId })
  if (error) throw error
}

/**
 * Creates an invitation. With `personId` (someone added by name), whoever
 * accepts takes their place: what was recorded for them becomes theirs.
 */
export async function inviteToTrip(tripId: string, email: string, name: string, personId?: string): Promise<TripInvitation> {
  const { data, error } = await supabase
    .from('trip_invitations')
    .insert({
      trip_id: tripId,
      invited_email: email.trim().toLowerCase(),
      invited_name: name.trim() || null,
      person_id: personId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export type ManagedInvitation = TripInvitation & { state: Exclude<InvitationState, 'accepted'> }

/**
 * Invitations an owner still has to act on: waiting (pending), and recent ones
 * that didn't work out (expired, declined). Accepted ones are trip members now.
 */
export async function listTripInvitations(tripId: string): Promise<ManagedInvitation[]> {
  const { data, error } = await supabase
    .from('trip_invitations')
    .select('*')
    .eq('trip_id', tripId)
    .neq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  const now = new Date()
  return data.map((invitation) => ({
    ...invitation,
    state: invitationState(invitation, now) as ManagedInvitation['state'],
  }))
}

/** Sends an invitation again: a fresh 7-day window and a new link (the old link stops working). */
export async function renewInvitation(invitationId: string): Promise<TripInvitation> {
  const { data, error } = await supabase.rpc('renew_invitation', { p_invitation_id: invitationId })
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
  tripKind: TripKind
  tripName: string
  destination: string | null
  startDate: string
  /** null for budgets */
  endDate: string | null
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
    tripKind: row.trip_kind,
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
  tripKind: TripKind
  tripName: string
  destination: string | null
  startDate: string
  /** null for budgets */
  endDate: string | null
  invitedByName: string
  invitedByAvatarUrl: string | null
  invitedName: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  alreadyMember: boolean
  /** Set when the invite is for someone added by name: whose place they take */
  personName: string | null
}

/** What an invite link shows before joining; null when the link is unknown. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc('get_invitation_preview', { p_token: token })
  if (error) throw error
  const row = data[0]
  if (!row) return null
  return {
    tripId: row.trip_id,
    tripKind: row.trip_kind,
    tripName: row.trip_name,
    destination: row.destination ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    invitedByName: row.invited_by_name ?? 'Someone',
    invitedByAvatarUrl: row.invited_by_avatar_url ?? null,
    invitedName: row.invited_name ?? null,
    status: row.status as InvitationPreview['status'],
    alreadyMember: row.already_member,
    personName: row.person_name ?? null,
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
