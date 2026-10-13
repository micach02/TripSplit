import { supabase } from '@/lib/supabase'
import { NotPermittedError } from '@/services/memberService'
import { removeReceipt, uploadReceipt } from '@/services/storageService'
import type { Expense, ExpenseSplit, PaymentMethod, SplitType } from '@/types/models'
import type { PastExpense } from '@/utils/suggestions'

export type ExpenseSort = 'newest' | 'oldest' | 'highest' | 'lowest'

export interface ExpenseFilters {
  search: string
  categoryId: string
  paidBy: string
  /** Expenses this person paid for or shares in */
  involving: string
  dateFrom: string
  dateTo: string
  /** Trip-currency decimals as typed (already validated), or '' */
  minAmount: string
  maxAmount: string
  sort: ExpenseSort
}

export const EMPTY_EXPENSE_FILTERS: ExpenseFilters = {
  search: '',
  categoryId: '',
  paidBy: '',
  involving: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  sort: 'newest',
}

export const EXPENSE_PAGE_SIZE = 20

const EXPENSE_FIELDS =
  'id, trip_id, category_id, description, amount, currency, exchange_rate, converted_amount, paid_by, ' +
  'expense_date, notes, receipt_url, created_by, created_at, updated_at, payment_method, recurring_id, recurring_period, ' +
  'expense_splits(user_id, split_type, value, amount)'

export type ExpenseWithSplits = Omit<Expense, 'participant_ids'> & {
  expense_splits: Array<Pick<ExpenseSplit, 'user_id' | 'split_type' | 'value' | 'amount'>>
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export async function listExpenses(
  tripId: string,
  filters: ExpenseFilters,
  offset: number,
  pageSize: number = EXPENSE_PAGE_SIZE,
): Promise<{ items: ExpenseWithSplits[]; total: number }> {
  let query = supabase.from('expenses').select(EXPENSE_FIELDS, { count: 'exact' }).eq('trip_id', tripId)

  const term = filters.search.trim()
  if (term) query = query.ilike('description', `%${escapeLike(term)}%`)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.paidBy) query = query.eq('paid_by', filters.paidBy)
  if (filters.involving) query = query.contains('participant_ids', [filters.involving])
  if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('expense_date', filters.dateTo)
  // Two-decimal strings → numbers is exact here; PostgREST receives the same digits.
  if (filters.minAmount) query = query.gte('converted_amount', Number(filters.minAmount))
  if (filters.maxAmount) query = query.lte('converted_amount', Number(filters.maxAmount))

  switch (filters.sort) {
    case 'oldest':
      query = query.order('expense_date', { ascending: true }).order('created_at', { ascending: true })
      break
    case 'highest':
      query = query.order('converted_amount', { ascending: false }).order('expense_date', { ascending: false })
      break
    case 'lowest':
      query = query.order('converted_amount', { ascending: true }).order('expense_date', { ascending: false })
      break
    default:
      query = query.order('expense_date', { ascending: false }).order('created_at', { ascending: false })
  }

  const { data, error, count } = await query
    .range(offset, offset + pageSize - 1)
    .overrideTypes<ExpenseWithSplits[], { merge: false }>()
  if (error) throw error
  return { items: data, total: count ?? data.length }
}

export async function getExpense(expenseId: string): Promise<ExpenseWithSplits | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_FIELDS)
    .eq('id', expenseId)
    .overrideTypes<ExpenseWithSplits[], { merge: false }>()
  if (error) throw error
  return data[0] ?? null
}

export interface ExpenseDraft {
  id?: string
  /** New expenses: the id to create it with (offline saves sync exactly once) */
  clientId?: string
  tripId: string
  categoryId: string
  description: string
  /** Decimal string in the expense currency */
  amount: string
  currency: string
  /** Decimal string: trip-currency units per 1 unit of `currency` */
  exchangeRate: string
  paidBy: string
  expenseDate: string
  notes: string
  paymentMethod: PaymentMethod | null
  /** Adding a recurring reminder's expense: which template and month ('yyyy-MM') */
  recurringId?: string | null
  recurringMonth?: string | null
  splits: Array<{
    userId: string
    splitType: SplitType
    value: string | null
    /** Decimal string in the trip currency */
    amount: string
  }>
}

/** Creates or updates an expense and its splits atomically. Returns the expense id. */
export async function saveExpense(draft: ExpenseDraft): Promise<string> {
  const { data, error } = await supabase.rpc('save_expense', {
    p_expense: {
      id: draft.id ?? null,
      trip_id: draft.tripId,
      category_id: draft.categoryId,
      description: draft.description,
      amount: draft.amount,
      currency: draft.currency,
      exchange_rate: draft.exchangeRate,
      paid_by: draft.paidBy,
      expense_date: draft.expenseDate,
      notes: draft.notes,
      payment_method: draft.paymentMethod ?? '',
      client_id: draft.id ? null : (draft.clientId ?? null),
      recurring_id: draft.recurringId ?? null,
      recurring_period: draft.recurringId && draft.recurringMonth ? `${draft.recurringMonth}-01` : null,
    },
    p_splits: draft.splits.map((split) => ({
      user_id: split.userId,
      split_type: split.splitType,
      value: split.value,
      amount: split.amount,
    })),
  })
  if (error) throw error
  return data
}

/** Deletes an expense and (best effort) its receipt file. */
export async function deleteExpense(expense: Pick<Expense, 'id' | 'receipt_url'>): Promise<void> {
  // Remove the file first: once the expense is gone, storage policies no longer allow it.
  await removeReceipt(expense.receipt_url).catch(() => undefined)
  const { data, error } = await supabase.from('expenses').delete().eq('id', expense.id).select('id')
  if (error) throw error
  if (data.length === 0) throw new NotPermittedError()
}

/** Your own recent expenses in a budget or trip, newest first: the basis of suggestions. */
export async function listMyRecentExpenses(tripId: string, userId: string, limit = 120): Promise<PastExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('description, category_id, amount, currency, payment_method, created_at')
    .eq('trip_id', tripId)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map((row) => ({
    description: row.description,
    categoryId: row.category_id,
    amount: String(row.amount),
    currency: row.currency,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
  }))
}

/** Every expense matching the filters (for exports), oldest first. */
export async function listAllExpenses(tripId: string, filters: ExpenseFilters): Promise<ExpenseWithSplits[]> {
  const pageSize = 500
  const all: ExpenseWithSplits[] = []
  for (let offset = 0; offset < 50_000; offset += pageSize) {
    const page = await listExpenses(tripId, { ...filters, sort: 'oldest' }, offset, pageSize)
    all.push(...page.items)
    if (all.length >= page.total || page.items.length < pageSize) break
  }
  return all
}

/** Points an expense at an uploaded receipt (or clears it). */
export async function setExpenseReceipt(expenseId: string, receiptPath: string | null): Promise<void> {
  const { error } = await supabase.from('expenses').update({ receipt_url: receiptPath }).eq('id', expenseId)
  if (error) throw error
}

/** What should happen to an expense's receipt when the form is saved. */
export type ReceiptChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; file: File }

/**
 * Applies a receipt change to a saved expense. The new file is uploaded and
 * linked before the old one is removed, so a failure never leaves the expense
 * pointing at a missing file.
 */
export async function applyReceiptChange(
  expense: Pick<Expense, 'id' | 'trip_id' | 'receipt_url'>,
  change: { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; image: Blob },
): Promise<void> {
  if (change.kind === 'keep') return
  if (change.kind === 'remove') {
    if (!expense.receipt_url) return
    await setExpenseReceipt(expense.id, null)
    await removeReceipt(expense.receipt_url).catch(() => undefined)
    return
  }
  const path = await uploadReceipt(expense.trip_id, expense.id, change.image)
  try {
    await setExpenseReceipt(expense.id, path)
  } catch (error) {
    await removeReceipt(path).catch(() => undefined)
    throw error
  }
  if (expense.receipt_url) await removeReceipt(expense.receipt_url).catch(() => undefined)
}

export interface RecentExpense {
  id: string
  tripId: string
  tripName: string
  currency: string
  description: string
  convertedAmount: number
  expenseDate: string
  payerName: string
  categoryIcon: string
  categoryColor: string
}

/** Latest expenses across all of the user's trips (dashboard). */
export async function listRecentExpenses(limit = 5): Promise<RecentExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id, trip_id, description, converted_amount, expense_date, ' +
        'trips(name, currency), categories(icon, color), payer:profiles!expenses_paid_by_fkey(full_name)',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<
      Array<{
        id: string
        trip_id: string
        description: string
        converted_amount: number
        expense_date: string
        trips: { name: string; currency: string } | null
        categories: { icon: string; color: string } | null
        payer: { full_name: string } | null
      }>,
      { merge: false }
    >()
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    tripId: row.trip_id,
    tripName: row.trips?.name ?? 'Trip',
    currency: row.trips?.currency ?? 'PHP',
    description: row.description,
    convertedAmount: row.converted_amount,
    expenseDate: row.expense_date,
    payerName: row.payer?.full_name ?? 'Someone',
    categoryIcon: row.categories?.icon ?? '📦',
    categoryColor: row.categories?.color ?? '#64748b',
  }))
}
