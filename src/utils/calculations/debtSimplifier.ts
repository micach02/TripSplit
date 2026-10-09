/**
 * Turns balances into as few payments as practical.
 *
 * 1. People whose debt exactly matches someone's credit pay them directly
 *    (one payment settles two people at once).
 * 2. The rest is greedy: the biggest debtor pays the biggest creditor, again
 *    and again. This never needs more than (people − 1) payments.
 *
 * Finding the true minimum is NP-hard in general; this is the standard
 * practical approach and is deterministic (ties broken by user id).
 */

export interface Transfer {
  from: string
  to: string
  /** Minor units */
  amount: number
}

interface Party {
  userId: string
  amount: number
}

const byAmountThenId = (a: Party, b: Party) => b.amount - a.amount || a.userId.localeCompare(b.userId)

export function simplifyDebts(balances: ReadonlyArray<{ userId: string; net: number }>): Transfer[] {
  const total = balances.reduce((sum, balance) => sum + balance.net, 0)
  if (total !== 0) throw new RangeError(`Balances must sum to zero (got ${total})`)

  let creditors: Party[] = balances.filter((b) => b.net > 0).map((b) => ({ userId: b.userId, amount: b.net }))
  let debtors: Party[] = balances.filter((b) => b.net < 0).map((b) => ({ userId: b.userId, amount: -b.net }))
  creditors.sort(byAmountThenId)
  debtors.sort(byAmountThenId)

  const transfers: Transfer[] = []

  // 1. Exact matches
  for (const debtor of debtors) {
    const match = creditors.find((creditor) => creditor.amount === debtor.amount && creditor.amount > 0)
    if (match && debtor.amount > 0) {
      transfers.push({ from: debtor.userId, to: match.userId, amount: debtor.amount })
      match.amount = 0
      debtor.amount = 0
    }
  }
  creditors = creditors.filter((c) => c.amount > 0)
  debtors = debtors.filter((d) => d.amount > 0)

  // 2. Greedy: largest debt to largest credit
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(byAmountThenId)
    debtors.sort(byAmountThenId)
    const creditor = creditors[0]
    const debtor = debtors[0]
    const amount = Math.min(creditor.amount, debtor.amount)
    transfers.push({ from: debtor.userId, to: creditor.userId, amount })
    creditor.amount -= amount
    debtor.amount -= amount
    creditors = creditors.filter((c) => c.amount > 0)
    debtors = debtors.filter((d) => d.amount > 0)
  }

  return transfers
}
