import { supabase } from '@/lib/supabase'
import { NotPermittedError } from '@/services/memberService'
import type { Income } from '@/types/models'

/** Personal income: only ever visible to you. */
export interface IncomeInput {
  /** Decimal string in `currency` */
  amount: string
  currency: string
  receivedOn: string
  source: string
  notes: string
}

function toRow(input: IncomeInput) {
  return {
    amount: Number(input.amount),
    currency: input.currency,
    received_on: input.receivedOn,
    source: input.source.trim(),
    notes: input.notes.trim() || null,
  }
}

export async function listIncomes(from: string, to: string): Promise<Income[]> {
  const { data, error } = await supabase
    .from('incomes')
    .select('*')
    .gte('received_on', from)
    .lte('received_on', to)
    .order('received_on', { ascending: false })
  if (error) throw error
  return data
}

export async function createIncome(input: IncomeInput): Promise<Income> {
  const { data, error } = await supabase.from('incomes').insert(toRow(input)).select('*').single()
  if (error) throw error
  return data
}

export async function updateIncome(id: string, input: IncomeInput): Promise<void> {
  const { data, error } = await supabase.from('incomes').update(toRow(input)).eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}

export async function deleteIncome(id: string): Promise<void> {
  const { data, error } = await supabase.from('incomes').delete().eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}
