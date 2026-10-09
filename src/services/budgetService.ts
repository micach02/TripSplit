import { supabase } from '@/lib/supabase'
import { toMinor } from '@/utils/calculations/money'

export interface CategoryBudget {
  id: string
  categoryId: string
  /** Trip-currency minor units */
  planned: number
}

export async function listCategoryBudgets(tripId: string, currency: string): Promise<CategoryBudget[]> {
  const { data, error } = await supabase.from('budget_categories').select('id, category_id, planned_amount').eq('trip_id', tripId)
  if (error) throw error
  return data.map((row) => ({ id: row.id, categoryId: row.category_id, planned: toMinor(row.planned_amount, currency) }))
}

/**
 * Sets (or clears, with an empty amount) the planned budget for one category.
 * Owners only — RLS enforces it.
 */
export async function saveCategoryBudget(
  tripId: string,
  categoryId: string,
  /** Decimal string in the trip currency, or '' to remove the budget */
  planned: string,
  existingId: string | null,
): Promise<void> {
  if (!planned) {
    if (!existingId) return
    const { error } = await supabase.from('budget_categories').delete().eq('id', existingId)
    if (error) throw error
    return
  }

  // Two-decimal strings → numbers is exact here; PostgREST receives the same digits.
  const plannedAmount = Number(planned)
  if (existingId) {
    const { error } = await supabase.from('budget_categories').update({ planned_amount: plannedAmount }).eq('id', existingId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('budget_categories')
      .insert({ trip_id: tripId, category_id: categoryId, planned_amount: plannedAmount })
    if (error) throw error
  }
}
