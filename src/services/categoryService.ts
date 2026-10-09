import { supabase } from '@/lib/supabase'
import { NotPermittedError } from '@/services/memberService'
import type { Category } from '@/types/models'

export interface CategoryInput {
  name: string
  icon: string
  color: string
}

export class CategoryInUseError extends Error {
  constructor() {
    super('category_in_use')
    this.name = 'CategoryInUseError'
  }
}

export async function createCategory(tripId: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ trip_id: tripId, name: input.name.trim(), icon: input.icon, color: input.color, sort_order: 50 })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(categoryId: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: input.name.trim(), icon: input.icon, color: input.color })
    .eq('id', categoryId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Deletes an unused category. Categories with expenses can't be deleted. */
export async function deleteCategory(categoryId: string): Promise<void> {
  const { data, error } = await supabase.from('categories').delete().eq('id', categoryId).select('id')
  if (error) {
    if (error.code === '23503') throw new CategoryInUseError()
    throw error
  }
  if (data.length === 0) throw new NotPermittedError()
}
