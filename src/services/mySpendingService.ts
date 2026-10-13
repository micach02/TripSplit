import { supabase } from '@/lib/supabase'
import { makeConverter } from '@/services/currencyConverter'
import { listIncomes } from '@/services/incomeService'
import type { Income } from '@/types/models'
import { monthPeriod, recentMonths, shiftMonth } from '@/utils/budgetPeriod'
import { toMinor } from '@/utils/calculations/money'
import { summarizeMySpending, type MySpendingSummary, type ShareRow } from '@/utils/calculations/mySpending'
import { todayIso } from '@/utils/tripStatus'

const PAGE = 1000

/** Your share of every expense dated between `from` and `to` ('yyyy-MM-dd'), across all budgets and trips. */
export async function listMyShares(from: string, to: string): Promise<ShareRow[]> {
  const rows: ShareRow[] = []
  for (let offset = 0; offset < PAGE * 20; offset += PAGE) {
    const { data, error } = await supabase
      .from('my_expense_shares')
      .select('*')
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    for (const row of data) {
      if (!row.expense_id || !row.trip_id || !row.trip_currency || !row.expense_date) continue
      rows.push({
        expenseId: row.expense_id,
        tripId: row.trip_id,
        tripName: row.trip_name ?? 'Untitled',
        tripKind: row.trip_kind ?? 'trip',
        tripCurrency: row.trip_currency,
        categoryName: row.category_name ?? 'Other',
        categoryIcon: row.category_icon ?? '📦',
        categoryColor: row.category_color ?? '#64748b',
        description: row.description ?? '',
        date: row.expense_date,
        paymentMethod: row.payment_method ?? null,
        paidBy: row.paid_by ?? '',
        total: toMinor(row.total ?? 0, row.trip_currency),
        myShare: toMinor(row.my_share ?? 0, row.trip_currency),
      })
    }
    if (data.length < PAGE) break
  }
  return rows
}

/** My spending for `month` ('yyyy-MM') in `currency`, with a `trendLength`-month trend. */
export async function getMySpending(
  month: string,
  currency: string,
  userId: string,
  trendLength = 6,
): Promise<{ summary: MySpendingSummary; incomes: Income[] }> {
  const first = shiftMonth(month, -(trendLength - 1))
  const period = monthPeriod(month)
  const [rows, incomes] = await Promise.all([
    listMyShares(monthPeriod(first).start, period.end),
    listIncomes(period.start, period.end),
  ])
  const { convert } = await makeConverter(
    [...rows.map((row) => row.tripCurrency), ...incomes.map((income) => income.currency)],
    currency,
  )
  const summary = summarizeMySpending({
    rows,
    incomes: incomes.map((income) => ({
      id: income.id,
      amount: toMinor(income.amount, income.currency),
      currency: income.currency,
      date: income.received_on,
      source: income.source,
    })),
    month,
    trendMonths: recentMonths(month, trendLength, first),
    userId,
    convert,
    today: todayIso(),
  })
  return { summary, incomes }
}
