/**
 * Per-person balances for a trip, in trip-currency minor units.
 *
 *   net = paid − share + settlements paid − settlements received
 *
 * Positive → the person should receive money. Negative → they owe money.
 * Across a trip the nets always sum to zero (every split adds up to its
 * expense, and every settlement moves the same amount out and in).
 */

export interface LedgerExpense {
  paidBy: string
  /** Converted total, minor units */
  total: number
  splits: ReadonlyArray<{ userId: string; amount: number }>
}

export interface LedgerSettlement {
  fromUserId: string
  toUserId: string
  /** Minor units */
  amount: number
}

export interface MemberBalance {
  userId: string
  paid: number
  share: number
  settlementsPaid: number
  settlementsReceived: number
  net: number
}

export function calculateBalances(
  memberIds: readonly string[],
  expenses: readonly LedgerExpense[],
  settlements: readonly LedgerSettlement[] = [],
): MemberBalance[] {
  const balances = new Map<string, MemberBalance>()
  const get = (userId: string) => {
    let balance = balances.get(userId)
    if (!balance) {
      balance = { userId, paid: 0, share: 0, settlementsPaid: 0, settlementsReceived: 0, net: 0 }
      balances.set(userId, balance)
    }
    return balance
  }

  memberIds.forEach(get)
  for (const expense of expenses) {
    get(expense.paidBy).paid += expense.total
    for (const split of expense.splits) get(split.userId).share += split.amount
  }
  for (const settlement of settlements) {
    get(settlement.fromUserId).settlementsPaid += settlement.amount
    get(settlement.toUserId).settlementsReceived += settlement.amount
  }

  return [...balances.values()].map((balance) => ({
    ...balance,
    net: balance.paid - balance.share + balance.settlementsPaid - balance.settlementsReceived,
  }))
}

/** "should receive ₱5,000" / "owes ₱3,000" / "is settled up" */
export function describeBalance(net: number): 'receives' | 'owes' | 'settled' {
  return net > 0 ? 'receives' : net < 0 ? 'owes' : 'settled'
}
