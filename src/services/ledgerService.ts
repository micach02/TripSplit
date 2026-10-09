import { supabase } from '@/lib/supabase'
import type { PaymentMethod } from '@/types/models'
import { toMinor } from '@/utils/calculations/money'

/**
 * Everything balances and analytics need for one trip, in trip-currency
 * minor units. Expenses are fetched in pages so large trips aren't cut off
 * by the API's row limit.
 */

export interface LedgerEntry {
  id: string
  categoryId: string
  date: string
  paidBy: string
  total: number
  splits: Array<{ userId: string; amount: number }>
}

export interface SettlementRecord {
  id: string
  fromUserId: string
  toUserId: string
  amount: number
  method: PaymentMethod
  date: string
  note: string | null
  createdBy: string | null
  createdAt: string
}

export interface CategoryBudgetRecord {
  id: string
  categoryId: string
  planned: number
}

export interface TripLedger {
  expenses: LedgerEntry[]
  settlements: SettlementRecord[]
  budgets: CategoryBudgetRecord[]
}

const PAGE = 1000

async function fetchAllExpenses(tripId: string, currency: string): Promise<LedgerEntry[]> {
  const entries: LedgerEntry[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, category_id, expense_date, paid_by, converted_amount, expense_splits(user_id, amount)')
      .eq('trip_id', tripId)
      .order('expense_date')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    for (const row of data) {
      entries.push({
        id: row.id,
        categoryId: row.category_id,
        date: row.expense_date,
        paidBy: row.paid_by,
        total: toMinor(row.converted_amount, currency),
        splits: row.expense_splits.map((split) => ({ userId: split.user_id, amount: toMinor(split.amount, currency) })),
      })
    }
    if (data.length < PAGE) return entries
  }
}

export async function getTripLedger(tripId: string, currency: string): Promise<TripLedger> {
  const [expenses, settlementsResult, budgetsResult] = await Promise.all([
    fetchAllExpenses(tripId, currency),
    supabase
      .from('settlements')
      .select('id, from_user_id, to_user_id, amount, payment_method, settlement_date, note, created_by, created_at')
      .eq('trip_id', tripId)
      .order('settlement_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('budget_categories').select('id, category_id, planned_amount').eq('trip_id', tripId),
  ])
  if (settlementsResult.error) throw settlementsResult.error
  if (budgetsResult.error) throw budgetsResult.error

  return {
    expenses,
    settlements: settlementsResult.data.map((row) => ({
      id: row.id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      amount: toMinor(row.amount, currency),
      method: row.payment_method,
      date: row.settlement_date,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    })),
    budgets: budgetsResult.data.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      planned: toMinor(row.planned_amount, currency),
    })),
  }
}
