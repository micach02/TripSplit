import { supabase } from '@/lib/supabase'
import { NotPermittedError } from '@/services/memberService'
import type { PaymentMethod } from '@/types/models'

export { PAYMENT_METHOD_LABELS } from '@/utils/paymentMethods'

export interface SettlementInput {
  tripId: string
  tripCurrency: string
  fromUserId: string
  toUserId: string
  /** Decimal string in the trip currency */
  amount: string
  method: PaymentMethod
  date: string
  note: string
}

/** Records "from paid to". The database stores it in the trip currency. */
export async function recordSettlement(input: SettlementInput): Promise<void> {
  const { error } = await supabase.from('settlements').insert({
    trip_id: input.tripId,
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    // Two-decimal strings → numbers is exact here; PostgREST receives the same digits.
    amount: Number(input.amount),
    currency: input.tripCurrency,
    payment_method: input.method,
    settlement_date: input.date,
    note: input.note.trim() || null,
  })
  if (error) throw error
}

export async function deleteSettlement(settlementId: string): Promise<void> {
  const { data, error } = await supabase.from('settlements').delete().eq('id', settlementId).select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}

export interface RecentSettlement {
  id: string
  tripId: string
  tripName: string
  amount: number
  currency: string
  date: string
  method: PaymentMethod
  fromName: string
  toName: string
}

/** Latest settlements across all of the user's trips (dashboard). */
export async function listRecentSettlements(limit = 5): Promise<RecentSettlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select(
      'id, trip_id, amount, currency, settlement_date, payment_method, trips(name), ' +
        'from:profiles!settlements_from_user_id_fkey(full_name), to:profiles!settlements_to_user_id_fkey(full_name)',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<
      Array<{
        id: string
        trip_id: string
        amount: number
        currency: string
        settlement_date: string
        payment_method: PaymentMethod
        trips: { name: string } | null
        from: { full_name: string } | null
        to: { full_name: string } | null
      }>,
      { merge: false }
    >()
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    tripId: row.trip_id,
    tripName: row.trips?.name ?? 'Trip',
    amount: row.amount,
    currency: row.currency,
    date: row.settlement_date,
    method: row.payment_method,
    fromName: row.from?.full_name ?? 'Someone',
    toName: row.to?.full_name ?? 'Someone',
  }))
}
