import { supabase } from '@/lib/supabase'
import { NotPermittedError } from '@/services/memberService'
import type { Database } from '@/types/database'
import type { PaymentMethod, RecurringExpense, RecurringMode } from '@/types/models'

export interface RecurringInput {
  categoryId: string
  description: string
  /** Decimal string in the trip currency */
  amount: string
  paidBy: string
  participantIds: string[]
  paymentMethod: PaymentMethod | null
  dayOfMonth: number
  mode: RecurringMode
}

function toRow(input: RecurringInput) {
  return {
    category_id: input.categoryId,
    description: input.description.trim(),
    amount: Number(input.amount),
    paid_by: input.paidBy,
    participant_ids: input.participantIds,
    payment_method: input.paymentMethod,
    day_of_month: input.dayOfMonth,
    mode: input.mode,
  }
}

export async function listRecurring(tripId: string): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('active', { ascending: false })
    .order('day_of_month')
  if (error) throw error
  return data
}

export async function createRecurring(tripId: string, input: RecurringInput): Promise<RecurringExpense> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert({ trip_id: tripId, ...toRow(input) })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateRecurring(id: string, changes: Partial<RecurringInput> & { active?: boolean }): Promise<void> {
  const full = changes as RecurringInput
  const row: Database['tripsplit']['Tables']['recurring_expenses']['Update'] = {}
  if (changes.categoryId !== undefined) row.category_id = full.categoryId
  if (changes.description !== undefined) row.description = full.description.trim()
  if (changes.amount !== undefined) row.amount = Number(full.amount)
  if (changes.paidBy !== undefined) row.paid_by = full.paidBy
  if (changes.participantIds !== undefined) row.participant_ids = full.participantIds
  if (changes.paymentMethod !== undefined) row.payment_method = full.paymentMethod
  if (changes.dayOfMonth !== undefined) row.day_of_month = full.dayOfMonth
  if (changes.mode !== undefined) row.mode = full.mode
  if (changes.active !== undefined) row.active = changes.active
  const { data, error } = await supabase.from('recurring_expenses').update(row).eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}

export async function deleteRecurring(id: string): Promise<void> {
  const { data, error } = await supabase.from('recurring_expenses').delete().eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}

/** Adds automatic recurring expenses that have come due (one trip, or all of yours). Returns how many were added. */
export async function postDueRecurring(tripId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('post_due_recurring', tripId ? { p_trip_id: tripId } : {})
  if (error) throw error
  return data
}

/** "Not this month": moves a reminder past `month` ('yyyy-MM'). */
export async function skipRecurring(id: string, month: string): Promise<void> {
  const { error } = await supabase.rpc('skip_recurring', { p_recurring_id: id, p_period: `${month}-01` })
  if (error) throw error
}
