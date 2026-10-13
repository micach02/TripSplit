import { describe, expect, it } from 'vitest'
import { buildTripContext } from '@/hooks/useTripContext'
import type { TripDetails } from '@/services/tripService'
import type { Trip } from '@/types/models'

function details(trip: Partial<Trip>, months: TripDetails['months'] = []): TripDetails {
  return {
    trip: {
      id: 't1',
      kind: 'budget',
      name: 'Groceries & Food',
      owner_id: 'u1',
      start_date: '2026-09-01',
      end_date: null,
      budget: 12000,
      currency: 'PHP',
      status: 'active',
      destination: null,
      description: null,
      cover_image_url: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      ...trip,
    } as Trip,
    effectiveStatus: 'active',
    budgetMinor: 1_200_000,
    spentMinor: 900_000,
    expenseCount: 9,
    months,
    coverUrl: null,
    members: [],
    categories: [],
  }
}

const reload = () => undefined
const TODAY = '2026-10-14'

describe('buildTripContext for budgets', () => {
  const months = [
    { month: '2026-09', spentMinor: 600_000, expenseCount: 6 },
    { month: '2026-10', spentMinor: 300_000, expenseCount: 3 },
  ]

  it('views the current month by default, with that month’s spending', () => {
    const context = buildTripContext(details({}, months), 'u1', reload, { today: TODAY })
    expect(context.isBudget).toBe(true)
    expect(context.copy.noun).toBe('budget')
    expect(context.period?.month).toBe('2026-10')
    expect(context.periodSpentMinor).toBe(300_000)
    expect(context.periodExpenseCount).toBe(3)
    expect(context.monthRange).toEqual({ earliest: '2026-09', latest: '2026-10' })
  })

  it('views an earlier month when asked', () => {
    const context = buildTripContext(details({}, months), 'u1', reload, { today: TODAY, month: '2026-09' })
    expect(context.period?.label).toBe('September 2026')
    expect(context.periodSpentMinor).toBe(600_000)
  })

  it('keeps the month within the budget’s life', () => {
    expect(buildTripContext(details({}, months), 'u1', reload, { today: TODAY, month: '2025-01' }).period?.month).toBe('2026-09')
    expect(buildTripContext(details({}, months), 'u1', reload, { today: TODAY, month: '2027-03' }).period?.month).toBe('2026-10')
  })

  it('lets you go back to months with expenses dated before the budget started', () => {
    const early = [{ month: '2026-07', spentMinor: 50_000, expenseCount: 1 }, ...months]
    const context = buildTripContext(details({}, early), 'u1', reload, { today: TODAY })
    expect(context.monthRange?.earliest).toBe('2026-07')
  })

  it('shows zero for a month with no spending', () => {
    const context = buildTripContext(details({ start_date: '2026-08-01' }, months), 'u1', reload, {
      today: TODAY,
      month: '2026-08',
    })
    expect(context.periodSpentMinor).toBe(0)
    expect(context.periodExpenseCount).toBe(0)
  })
})

describe('buildTripContext for trips', () => {
  it('has no month and uses all-time spending', () => {
    const context = buildTripContext(
      details({ kind: 'trip', end_date: '2026-10-20' }),
      'u1',
      reload,
      { today: TODAY, month: '2026-09' },
    )
    expect(context.isBudget).toBe(false)
    expect(context.copy.members).toBe('travelers')
    expect(context.period).toBeNull()
    expect(context.monthRange).toBeNull()
    expect(context.periodSpentMinor).toBe(900_000)
    expect(context.periodExpenseCount).toBe(9)
  })
})
