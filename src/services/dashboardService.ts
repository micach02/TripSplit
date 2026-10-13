import { cacheGet, cacheSet, isOfflineError } from '@/lib/offlineCache'
import { supabase } from '@/lib/supabase'
import { exchangeRates } from '@/services/exchangeRates'
import type { Trip } from '@/types/models'
import { convertMinor, toMinor } from '@/utils/calculations/money'
import { currentMonth } from '@/utils/budgetPeriod'
import { getTripStatus } from '@/utils/tripStatus'

export type DashboardTrip = Pick<
  Trip,
  'id' | 'kind' | 'name' | 'destination' | 'start_date' | 'end_date' | 'currency' | 'status'
> & {
  /** Minor units of the trip currency. Budgets: per month. */
  budget: number
  /** Minor units of the trip currency. Budgets: this month. */
  spent: number
}

export interface TripBalance {
  tripId: string
  tripName: string
  currency: string
  /** My net in the trip currency (minor units): + owed to me, − I owe */
  net: number
}

export interface DashboardSummary {
  /** Currency the totals are expressed in (the user's preferred currency). */
  currency: string
  tripCount: number
  activeTrips: DashboardTrip[]
  /** Totals across active trips and this month of every budget, converted into `currency` (minor units). */
  totals: { budget: number; spent: number; remaining: number }
  /** Active trips in another currency that were converted at today's rate. */
  convertedTripCount: number
  /** Active trips left out because their rate couldn't be loaded. */
  unconvertedTripCount: number
  /** My non-zero balances, largest first. */
  balances: TripBalance[]
  /** My balances converted into `currency`: what I'm owed and what I owe. */
  balanceTotals: { owedToMe: number; iOwe: number; complete: boolean }
}

/** getDashboardSummary, falling back to the last one loaded on this device when offline. */
export async function getDashboardSummaryOfflineFirst(currency: string, userId: string): Promise<DashboardSummary> {
  const key = `dashboard:${currency}`
  try {
    const summary = await getDashboardSummary(currency, userId)
    cacheSet(key, summary)
    return summary
  } catch (error) {
    const cached = isOfflineError(error) ? cacheGet<DashboardSummary>(key) : null
    if (cached) return cached
    throw error
  }
}

export async function getDashboardSummary(currency: string, userId: string): Promise<DashboardSummary> {
  const [tripsResult, totalsResult, monthResult, balancesResult] = await Promise.all([
    supabase
      .from('trips')
      .select('id, kind, name, destination, start_date, end_date, budget, currency, status')
      .order('start_date', { ascending: true }),
    supabase.from('trip_totals').select('trip_id, total_spent'),
    supabase.from('trip_month_totals').select('trip_id, total_spent').eq('month', `${currentMonth()}-01`),
    supabase.from('trip_member_balances').select('trip_id, net').eq('user_id', userId),
  ])
  if (tripsResult.error) throw tripsResult.error
  if (totalsResult.error) throw totalsResult.error
  if (monthResult.error) throw monthResult.error
  if (balancesResult.error) throw balancesResult.error

  const trips = tripsResult.data
  const spentByTrip = new Map(totalsResult.data.map((row) => [row.trip_id, row.total_spent ?? 0]))
  const spentThisMonth = new Map(monthResult.data.map((row) => [row.trip_id, row.total_spent ?? 0]))

  // One rate per foreign currency, fetched in parallel; null when unavailable.
  const foreign = [...new Set(trips.map((trip) => trip.currency).filter((code) => code !== currency))]
  const quotes = await Promise.all(foreign.map((code) => exchangeRates.getRate(code, currency)))
  const rates = new Map(foreign.map((code, index) => [code, quotes[index]?.rate ?? null]))
  const convert = (minor: number, from: string): number | null => {
    if (from === currency) return minor
    const rate = rates.get(from)
    return rate ? convertMinor(minor, from, currency, rate) : null
  }

  const activeTrips: DashboardTrip[] = trips
    .filter((trip) => getTripStatus(trip) === 'active')
    .map((trip) => ({
      ...trip,
      budget: toMinor(trip.budget, trip.currency),
      spent: toMinor(
        (trip.kind === 'budget' ? spentThisMonth.get(trip.id) : spentByTrip.get(trip.id)) ?? 0,
        trip.currency,
      ),
    }))

  let budget = 0
  let spent = 0
  let convertedTripCount = 0
  let unconvertedTripCount = 0
  for (const trip of activeTrips) {
    const tripBudget = convert(trip.budget, trip.currency)
    const tripSpent = convert(trip.spent, trip.currency)
    if (tripBudget === null || tripSpent === null) {
      unconvertedTripCount++
      continue
    }
    if (trip.currency !== currency) convertedTripCount++
    budget += tripBudget
    spent += tripSpent
  }

  const tripById = new Map(trips.map((trip) => [trip.id, trip]))
  const balances: TripBalance[] = balancesResult.data
    .map((row) => {
      const trip = row.trip_id ? tripById.get(row.trip_id) : undefined
      if (!trip) return null
      return { tripId: trip.id, tripName: trip.name, currency: trip.currency, net: toMinor(row.net ?? 0, trip.currency) }
    })
    .filter((balance): balance is TripBalance => balance !== null && balance.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  let owedToMe = 0
  let iOwe = 0
  let complete = true
  for (const balance of balances) {
    const converted = convert(balance.net, balance.currency)
    if (converted === null) {
      complete = false
      continue
    }
    if (converted > 0) owedToMe += converted
    else iOwe += -converted
  }

  return {
    currency,
    tripCount: trips.length,
    activeTrips,
    totals: { budget, spent, remaining: budget - spent },
    convertedTripCount,
    unconvertedTripCount,
    balances,
    balanceTotals: { owedToMe, iOwe, complete },
  }
}
