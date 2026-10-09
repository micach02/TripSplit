import { supabase } from '@/lib/supabase'
import { getCoverUrls, removeTripCover, removeTripReceipts, uploadTripCover } from '@/services/storageService'
import type { Category, MemberRole, Profile, Trip, TripStatus } from '@/types/models'
import { toMinor } from '@/utils/calculations/money'
import { getTripStatus } from '@/utils/tripStatus'

export class TripNotFoundError extends Error {
  constructor() {
    super('trip_not_found')
    this.name = 'TripNotFoundError'
  }
}

export interface TripMemberWithProfile {
  id: string
  userId: string
  role: MemberRole
  joinedAt: string
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>
}

/** A trip as shown in lists: money in minor units, status computed from dates. */
export interface TripListItem extends Trip {
  budgetMinor: number
  spentMinor: number
  effectiveStatus: TripStatus
  coverUrl: string | null
  members: Array<{ userId: string; fullName: string; avatarUrl: string | null }>
}

export interface TripDetails {
  trip: Trip
  effectiveStatus: TripStatus
  budgetMinor: number
  spentMinor: number
  expenseCount: number
  coverUrl: string | null
  members: TripMemberWithProfile[]
  categories: Category[]
}

export interface TripInput {
  name: string
  destination: string | null
  description: string | null
  startDate: string
  endDate: string
  /** Decimal string in the trip currency, e.g. "50000.00" */
  budget: string
  currency: string
}

export async function listTrips(): Promise<TripListItem[]> {
  const [tripsResult, totalsResult] = await Promise.all([
    supabase
      .from('trips')
      .select('*, trip_members(user_id, joined_at, profiles(full_name, avatar_url))')
      .order('start_date', { ascending: false }),
    supabase.from('trip_totals').select('trip_id, total_spent'),
  ])
  if (tripsResult.error) throw tripsResult.error
  if (totalsResult.error) throw totalsResult.error

  const spentByTrip = new Map(totalsResult.data.map((row) => [row.trip_id, row.total_spent ?? 0]))
  const coverUrls = await getCoverUrls(tripsResult.data.map((trip) => trip.cover_image_url))

  return tripsResult.data.map(({ trip_members: members, ...trip }) => ({
    ...trip,
    budgetMinor: toMinor(trip.budget, trip.currency),
    spentMinor: toMinor(spentByTrip.get(trip.id) ?? 0, trip.currency),
    effectiveStatus: getTripStatus(trip),
    coverUrl: trip.cover_image_url ? (coverUrls.get(trip.cover_image_url) ?? null) : null,
    members: [...members]
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((member) => ({
        userId: member.user_id,
        fullName: member.profiles?.full_name ?? 'Traveler',
        avatarUrl: member.profiles?.avatar_url ?? null,
      })),
  }))
}

export async function getTripDetails(tripId: string): Promise<TripDetails> {
  const [tripResult, membersResult, categoriesResult, totalsResult] = await Promise.all([
    supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
    supabase
      .from('trip_members')
      .select('id, user_id, role, joined_at, profiles(id, full_name, email, avatar_url)')
      .eq('trip_id', tripId)
      .order('joined_at'),
    supabase.from('categories').select('*').eq('trip_id', tripId).order('sort_order').order('name'),
    supabase.from('trip_totals').select('total_spent, expense_count').eq('trip_id', tripId).maybeSingle(),
  ])
  if (tripResult.error) throw tripResult.error
  if (!tripResult.data) throw new TripNotFoundError()
  if (membersResult.error) throw membersResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (totalsResult.error) throw totalsResult.error

  const trip = tripResult.data
  const coverUrls = await getCoverUrls([trip.cover_image_url])

  return {
    trip,
    effectiveStatus: getTripStatus(trip),
    budgetMinor: toMinor(trip.budget, trip.currency),
    spentMinor: toMinor(totalsResult.data?.total_spent ?? 0, trip.currency),
    expenseCount: totalsResult.data?.expense_count ?? 0,
    coverUrl: trip.cover_image_url ? (coverUrls.get(trip.cover_image_url) ?? null) : null,
    members: membersResult.data.map((member) => ({
      id: member.id,
      userId: member.user_id,
      role: member.role,
      joinedAt: member.joined_at,
      profile: member.profiles ?? { id: member.user_id, full_name: 'Traveler', email: '', avatar_url: null },
    })),
    categories: categoriesResult.data,
  }
}

function toRow(input: TripInput) {
  return {
    name: input.name.trim(),
    destination: input.destination?.trim() || null,
    description: input.description?.trim() || null,
    start_date: input.startDate,
    end_date: input.endDate,
    budget: Number(input.budget),
    currency: input.currency,
  }
}

/** Creates a trip (the database adds the owner as a member and default categories). */
export async function createTrip(input: TripInput, status: TripStatus, cover: Blob | null): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({ ...toRow(input), status })
    .select('*')
    .single()
  if (error) throw error

  if (!cover) return data
  try {
    return await setTripCover(data, cover)
  } catch {
    // The trip itself was created; a cover can be added again from Settings.
    return data
  }
}

export async function updateTrip(tripId: string, input: TripInput): Promise<Trip> {
  const { data, error } = await supabase.from('trips').update(toRow(input)).eq('id', tripId).select('*').single()
  if (error) throw error
  return data
}

export async function setTripStatus(tripId: string, status: TripStatus): Promise<void> {
  const { error } = await supabase.from('trips').update({ status }).eq('id', tripId)
  if (error) throw error
}

/** Uploads a new cover, points the trip at it and removes the old one. */
export async function setTripCover(trip: Pick<Trip, 'id' | 'cover_image_url'>, cover: Blob): Promise<Trip> {
  const path = await uploadTripCover(trip.id, cover)
  const { data, error } = await supabase
    .from('trips')
    .update({ cover_image_url: path })
    .eq('id', trip.id)
    .select('*')
    .single()
  if (error) {
    void removeTripCover(path).catch(() => undefined)
    throw error
  }
  void removeTripCover(trip.cover_image_url).catch(() => undefined)
  return data
}

export async function clearTripCover(trip: Pick<Trip, 'id' | 'cover_image_url'>): Promise<void> {
  const { error } = await supabase.from('trips').update({ cover_image_url: null }).eq('id', trip.id)
  if (error) throw error
  void removeTripCover(trip.cover_image_url).catch(() => undefined)
}

/**
 * Converts a trip to another currency (owner only). Budgets, settlements and
 * shares are converted at `rate` (units of the new currency per 1 of the old);
 * each expense keeps its original amount and currency.
 */
export async function changeTripCurrency(tripId: string, currency: string, rate: string): Promise<void> {
  // Rates have at most 8 decimals; as a number this round-trips exactly.
  const { error } = await supabase.rpc('change_trip_currency', {
    p_trip_id: tripId,
    p_currency: currency,
    p_rate: Number(rate),
  })
  if (error) throw error
}

export async function deleteTrip(trip: Pick<Trip, 'id' | 'cover_image_url'>): Promise<void> {
  // Remove files first: once the trip is gone, storage policies no longer allow it.
  await removeTripCover(trip.cover_image_url).catch(() => undefined)
  await removeTripReceipts(trip.id).catch(() => undefined)
  const { data, error } = await supabase.from('trips').delete().eq('id', trip.id).select('id')
  if (error) throw error
  if (data.length === 0) throw new TripNotFoundError()
}
