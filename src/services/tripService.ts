import { cacheGet, cacheSet, isOfflineError } from '@/lib/offlineCache'
import { supabase } from '@/lib/supabase'
import { getCoverUrls, removeTripCover, removeTripReceipts, uploadTripCover } from '@/services/storageService'
import type { Category, MemberRole, Profile, Trip, TripStatus } from '@/types/models'
import { toMinor } from '@/utils/calculations/money'
import { currentMonth, monthOf } from '@/utils/budgetPeriod'
import type { TripKind } from '@/utils/tripKind'
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
  /** `guest_trip_id` is set for someone added by name (no account, no email). */
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'guest_trip_id' | 'added_by'>
}

/**
 * A trip or budget as shown in lists: money in minor units, status computed
 * from dates. For budgets, budget and spent are for the current month.
 */
export interface TripListItem extends Trip {
  budgetMinor: number
  spentMinor: number
  effectiveStatus: TripStatus
  coverUrl: string | null
  members: Array<{ userId: string; fullName: string; avatarUrl: string | null }>
}

/** Spending in one calendar month ('yyyy-MM'), in trip-currency minor units. */
export interface MonthTotal {
  month: string
  spentMinor: number
  expenseCount: number
}

export interface TripDetails {
  trip: Trip
  effectiveStatus: TripStatus
  /** Trips: the total budget. Budgets: the amount per month. */
  budgetMinor: number
  /** All-time spending */
  spentMinor: number
  expenseCount: number
  /** Spending per month, oldest first (used by budgets) */
  months: MonthTotal[]
  /** Loaded from this device's offline copy (no connection) */
  fromCache?: boolean
  coverUrl: string | null
  members: TripMemberWithProfile[]
  categories: Category[]
}

export interface TripInput {
  kind: TripKind
  name: string
  destination: string | null
  description: string | null
  startDate: string
  /** null for budgets, which are ongoing */
  endDate: string | null
  /** Decimal string in the trip currency, e.g. "50000.00" */
  budget: string
  currency: string
  /** Budgets: carry unspent money (or overspending) into the next month */
  rollover?: boolean
  /** New trips: names to add once it exists (see memberService.addPeople) */
  people?: string[]
}

/** listTrips, falling back to the last list loaded on this device when offline. */
export async function listTripsOfflineFirst(): Promise<TripListItem[]> {
  try {
    const trips = await listTrips()
    cacheSet('trips', trips)
    return trips
  } catch (error) {
    const cached = isOfflineError(error) ? cacheGet<TripListItem[]>('trips') : null
    if (cached) return cached
    throw error
  }
}

export async function listTrips(): Promise<TripListItem[]> {
  const [tripsResult, totalsResult, monthResult] = await Promise.all([
    supabase
      .from('trips')
      .select('*, trip_members(user_id, joined_at, profiles(full_name, avatar_url))')
      .order('start_date', { ascending: false }),
    supabase.from('trip_totals').select('trip_id, total_spent'),
    // Budgets show this month's spending
    supabase.from('trip_month_totals').select('trip_id, total_spent').eq('month', `${currentMonth()}-01`),
  ])
  if (tripsResult.error) throw tripsResult.error
  if (totalsResult.error) throw totalsResult.error
  if (monthResult.error) throw monthResult.error

  const spentByTrip = new Map(totalsResult.data.map((row) => [row.trip_id, row.total_spent ?? 0]))
  const spentThisMonth = new Map(monthResult.data.map((row) => [row.trip_id, row.total_spent ?? 0]))
  const coverUrls = await getCoverUrls(tripsResult.data.map((trip) => trip.cover_image_url))

  return tripsResult.data.map(({ trip_members: members, ...trip }) => ({
    ...trip,
    budgetMinor: toMinor(trip.budget, trip.currency),
    spentMinor: toMinor(
      (trip.kind === 'budget' ? spentThisMonth.get(trip.id) : spentByTrip.get(trip.id)) ?? 0,
      trip.currency,
    ),
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
  const [tripResult, membersResult, categoriesResult, totalsResult, monthsResult] = await Promise.all([
    supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
    supabase
      .from('trip_members')
      .select('id, user_id, role, joined_at, profiles(id, full_name, email, avatar_url, guest_trip_id, added_by)')
      .eq('trip_id', tripId)
      .order('joined_at'),
    supabase.from('categories').select('*').eq('trip_id', tripId).order('sort_order').order('name'),
    supabase.from('trip_totals').select('total_spent, expense_count').eq('trip_id', tripId).maybeSingle(),
    supabase.from('trip_month_totals').select('month, total_spent, expense_count').eq('trip_id', tripId).order('month'),
  ])
  if (tripResult.error) throw tripResult.error
  if (!tripResult.data) throw new TripNotFoundError()
  if (membersResult.error) throw membersResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (totalsResult.error) throw totalsResult.error
  if (monthsResult.error) throw monthsResult.error

  const trip = tripResult.data
  const coverUrls = await getCoverUrls([trip.cover_image_url])

  return {
    trip,
    effectiveStatus: getTripStatus(trip),
    budgetMinor: toMinor(trip.budget, trip.currency),
    spentMinor: toMinor(totalsResult.data?.total_spent ?? 0, trip.currency),
    expenseCount: totalsResult.data?.expense_count ?? 0,
    months: monthsResult.data.flatMap((row) =>
      row.month
        ? [{ month: monthOf(row.month), spentMinor: toMinor(row.total_spent ?? 0, trip.currency), expenseCount: row.expense_count ?? 0 }]
        : [],
    ),
    coverUrl: trip.cover_image_url ? (coverUrls.get(trip.cover_image_url) ?? null) : null,
    members: membersResult.data.map((member) => ({
      id: member.id,
      userId: member.user_id,
      role: member.role,
      joinedAt: member.joined_at,
      profile: member.profiles ?? {
        id: member.user_id,
        full_name: 'Traveler',
        email: null,
        avatar_url: null,
        guest_trip_id: null,
        added_by: null,
      },
    })),
    categories: categoriesResult.data,
  }
}

/** The editable columns (`kind` is set once, at creation). */
function toRow(input: TripInput) {
  const budget = input.kind === 'budget'
  return {
    name: input.name.trim(),
    destination: budget ? null : input.destination?.trim() || null,
    description: input.description?.trim() || null,
    start_date: input.startDate,
    end_date: budget ? null : input.endDate,
    budget: Number(input.budget),
    currency: input.currency,
    rollover: budget ? Boolean(input.rollover) : false,
  }
}

/** Creates a trip or budget (the database adds the owner as a member and default categories for its kind). */
export async function createTrip(input: TripInput, status: TripStatus, cover: Blob | null): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({ ...toRow(input), kind: input.kind, status })
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
