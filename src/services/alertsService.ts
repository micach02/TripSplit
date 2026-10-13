import { supabase } from '@/lib/supabase'
import { currentMonth, monthOf } from '@/utils/budgetPeriod'
import { availableForMonth, budgetAlerts, type AlertInput, type BudgetAlert } from '@/utils/calculations/insights'
import { formatMoney, toMinor } from '@/utils/calculations/money'
import { getTripStatus } from '@/utils/tripStatus'

/**
 * Budget warnings for the bell: running monthly budgets (this month, with any
 * rollover, plus their category limits) and trips in progress (the whole trip).
 */
export async function getBudgetAlerts(): Promise<BudgetAlert[]> {
  const month = currentMonth()
  const [tripsResult, monthsResult, totalsResult, limitsResult, categorySpendResult] = await Promise.all([
    supabase.from('trips').select('id, kind, name, budget, currency, status, start_date, rollover'),
    supabase.from('trip_month_totals').select('trip_id, month, total_spent'),
    supabase.from('trip_totals').select('trip_id, total_spent'),
    supabase.from('budget_categories').select('trip_id, category_id, planned_amount'),
    supabase.from('trip_category_month_totals').select('trip_id, category_id, total_spent').eq('month', `${month}-01`),
  ])
  for (const result of [tripsResult, monthsResult, totalsResult, limitsResult, categorySpendResult]) {
    if (result.error) throw result.error
  }

  const running = (tripsResult.data ?? []).filter((trip) =>
    trip.kind === 'budget' ? trip.status !== 'completed' : getTripStatus(trip) === 'active',
  )
  if (running.length === 0) return []

  const categoryIds = [...new Set((limitsResult.data ?? []).map((limit) => limit.category_id))]
  const categoriesResult = categoryIds.length
    ? await supabase.from('categories').select('id, name, icon').in('id', categoryIds)
    : { data: [], error: null }
  if (categoriesResult.error) throw categoriesResult.error
  const categoryById = new Map((categoriesResult.data ?? []).map((category) => [category.id, category]))

  const inputs: AlertInput[] = running.map((trip) => {
    if (trip.kind === 'trip') {
      const spent = (totalsResult.data ?? []).find((row) => row.trip_id === trip.id)?.total_spent ?? 0
      return {
        tripId: trip.id,
        tripName: trip.name,
        currency: trip.currency,
        month: 'trip',
        budgetMinor: toMinor(trip.budget, trip.currency),
        spentMinor: toMinor(spent, trip.currency),
        categories: [],
      }
    }

    const spentByMonth = new Map(
      (monthsResult.data ?? [])
        .filter((row) => row.trip_id === trip.id && row.month)
        .map((row) => [monthOf(row.month as string), toMinor(row.total_spent ?? 0, trip.currency)]),
    )
    const { available } = availableForMonth(
      toMinor(trip.budget, trip.currency),
      trip.rollover,
      spentByMonth,
      monthOf(trip.start_date),
      month,
    )
    const categorySpend = new Map(
      (categorySpendResult.data ?? [])
        .filter((row) => row.trip_id === trip.id && row.category_id)
        .map((row) => [row.category_id as string, toMinor(row.total_spent ?? 0, trip.currency)]),
    )
    return {
      tripId: trip.id,
      tripName: trip.name,
      currency: trip.currency,
      month,
      budgetMinor: available,
      spentMinor: spentByMonth.get(month) ?? 0,
      categories: (limitsResult.data ?? [])
        .filter((limit) => limit.trip_id === trip.id)
        .map((limit) => {
          const category = categoryById.get(limit.category_id)
          return {
            id: limit.category_id,
            name: category?.name ?? 'Category',
            icon: category?.icon ?? '📦',
            limitMinor: toMinor(limit.planned_amount, trip.currency),
            spentMinor: categorySpend.get(limit.category_id) ?? 0,
          }
        }),
    }
  })

  return budgetAlerts(inputs, formatMoney)
}
