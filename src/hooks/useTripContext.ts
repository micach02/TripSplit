import { useOutletContext } from 'react-router'
import { makeTripMoney, type TripMoney } from '@/hooks/useDisplayCurrency'
import type { TripDetails, TripMemberWithProfile } from '@/services/tripService'
import type { Category } from '@/types/models'

/** What a trip's tabs receive from <TripLayout>. */
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
}

interface BuildOptions {
  money?: TripMoney
  requestedCurrency?: string
  setDisplayCurrency?: (currency: string) => void
}

export function buildTripContext(
  details: TripDetails,
  currentUserId: string,
  reload: () => void,
  { money, requestedCurrency, setDisplayCurrency }: BuildOptions = {},
): TripContextValue {
  const tripCurrency = details.trip.currency
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
