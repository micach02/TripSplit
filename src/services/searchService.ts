import { supabase } from '@/lib/supabase'
import { toMinor } from '@/utils/calculations/money'
import type { TripKind } from '@/utils/tripKind'

/** The newest matches only; add another word to narrow things down. */
export const SEARCH_LIMIT = 40

export interface ExpenseSearchResult {
  id: string
  tripId: string
  tripName: string
  tripKind: TripKind
  tripCurrency: string
  description: string
  notes: string | null
  date: string
  /** Minor units of the trip currency */
  amountMinor: number
  /** As entered, when that was another currency */
  original: { amount: number; currency: string } | null
  category: { name: string; icon: string; color: string } | null
  paidByName: string | null
}

/**
 * Expenses across every budget and trip you're on (tripsplit.search_expenses):
 * every word has to match the description, notes, category, budget or trip,
 * or who paid or shared it; a number also matches an amount. Newest first.
 */
export async function searchExpenses(query: string): Promise<ExpenseSearchResult[]> {
  const { data, error } = await supabase.rpc('search_expenses', { p_query: query, p_limit: SEARCH_LIMIT })
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    tripId: row.trip_id,
    tripName: row.trip_name,
    tripKind: row.trip_kind,
    tripCurrency: row.trip_currency,
    description: row.description,
    notes: row.notes ?? null,
    date: row.expense_date,
    amountMinor: toMinor(row.converted_amount, row.trip_currency),
    original: row.currency !== row.trip_currency ? { amount: row.amount, currency: row.currency } : null,
    category: row.category_name ? { name: row.category_name, icon: row.category_icon, color: row.category_color } : null,
    paidByName: row.paid_by_name ?? null,
  }))
}
