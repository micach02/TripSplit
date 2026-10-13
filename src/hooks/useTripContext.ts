import { useOutletContext } from 'react-router'
import { makeTripMoney, type TripMoney } from '@/hooks/useDisplayCurrency'
import type { TripDetails, TripMemberWithProfile } from '@/services/tripService'
import type { Category } from '@/types/models'
import { clampMonth, currentMonth, monthOf, monthPeriod, type MonthPeriod } from '@/utils/budgetPeriod'
import { availableForMonth } from '@/utils/calculations/insights'
import { kindCopy, type KindCopy } from '@/utils/tripKind'

/** What a trip's (or budget's) tabs receive from <TripLayout>. */
export interface TripContextValue extends TripDetails {
  currentUserId: string
  isOwner: boolean
  memberById: Map<string, TripMemberWithProfile>
  categoryById: Map<string, Category>
  /** Formats trip-currency amounts in the chosen display currency. */
  money: TripMoney
  /** The display currency the traveler picked (may still be loading). */
  requestedCurrency: string
  setDisplayCurrency: (currency: string) => void
  /** Re-fetch the trip (after edits, new expenses, membership changes). */
  reload: () => void

  /** An everyday monthly budget rather than a trip */
  isBudget: boolean
  /** "trip"/"budget", "travelers"/"people"… */
  copy: KindCopy
  /** Budgets: the month being viewed. Trips: null. */
  period: MonthPeriod | null
  /** Budgets: the months that can be viewed ('yyyy-MM'). Trips: null. */
  monthRange: { earliest: string; latest: string } | null
  setMonth: (month: string) => void
  /** Budgets: spending in the viewed month. Trips: all-time spending. */
  periodSpentMinor: number
  periodExpenseCount: number
  /** What can be spent: budgets include any rollover into the viewed month */
  availableMinor: number
  /** Budgets with rollover: carried into the viewed month (negative = overspent before) */
  carryMinor: number
}

interface BuildOptions {
  money?: TripMoney
  requestedCurrency?: string
  setDisplayCurrency?: (currency: string) => void
  /** Requested month ('yyyy-MM'), e.g. from the URL; clamped to the budget's life */
  month?: string | null
  setMonth?: (month: string) => void
  today?: string
}

export function buildTripContext(
  details: TripDetails,
  currentUserId: string,
  reload: () => void,
  { money, requestedCurrency, setDisplayCurrency, month, setMonth, today }: BuildOptions = {},
): TripContextValue {
  const tripCurrency = details.trip.currency
  const isBudget = details.trip.kind === 'budget'

  let period: MonthPeriod | null = null
  let monthRange: TripContextValue['monthRange'] = null
  let periodSpentMinor = details.spentMinor
  let periodExpenseCount = details.expenseCount
  let availableMinor = details.budgetMinor
  let carryMinor = 0
  if (isBudget) {
    const latest = currentMonth(today)
    // Expenses can be dated before the budget started; let people see those months too.
    const firstSpend = details.months[0]?.month
    const startMonth = monthOf(details.trip.start_date)
    const earliest = [startMonth, firstSpend, latest].filter((m): m is string => Boolean(m)).sort()[0]
    monthRange = { earliest, latest }
    period = monthPeriod(clampMonth(month ?? latest, earliest, latest))
    const totals = details.months.find((row) => row.month === period?.month)
    periodSpentMinor = totals?.spentMinor ?? 0
    periodExpenseCount = totals?.expenseCount ?? 0
    const rollover = availableForMonth(
      details.budgetMinor,
      details.trip.rollover,
      new Map(details.months.map((row) => [row.month, row.spentMinor])),
      startMonth,
      period.month,
    )
    availableMinor = rollover.available
    carryMinor = rollover.carry
  }

  return {
    ...details,
    currentUserId,
    isOwner: details.trip.owner_id === currentUserId,
    memberById: new Map(details.members.map((member) => [member.userId, member])),
    categoryById: new Map(details.categories.map((category) => [category.id, category])),
    money: money ?? makeTripMoney(tripCurrency, tripCurrency, null, false),
    requestedCurrency: requestedCurrency ?? tripCurrency,
    setDisplayCurrency: setDisplayCurrency ?? (() => undefined),
    reload,
    isBudget,
    copy: kindCopy(details.trip.kind),
    period,
    monthRange,
    setMonth: setMonth ?? (() => undefined),
    periodSpentMinor,
    periodExpenseCount,
    availableMinor,
    carryMinor,
  }
}

export function useTripContext(): TripContextValue {
  return useOutletContext<TripContextValue>()
}

/** Display name for a user id on this trip ("You" for the current user when `you` is set). */
export function memberName(
  context: Pick<TripContextValue, 'memberById' | 'currentUserId'>,
  userId: string | null,
  { you = false }: { you?: boolean } = {},
): string {
  if (!userId) return 'Someone'
  if (you && userId === context.currentUserId) return 'You'
  return context.memberById.get(userId)?.profile.full_name ?? 'Former member'
}
