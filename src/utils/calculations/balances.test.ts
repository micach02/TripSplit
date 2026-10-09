import { describe, expect, it } from 'vitest'
import { calculateBalances, describeBalance, type LedgerExpense } from './balanceCalculator'
import { simplifyDebts } from './debtSimplifier'

const peso = (major: number) => Math.round(major * 100)

const equal = (paidBy: string, total: number, people: string[]): LedgerExpense => {
  const each = Math.floor(total / people.length)
  const splits = people.map((userId, i) => ({
    userId,
    amount: i === people.length - 1 ? total - each * (people.length - 1) : each,
  }))
  return { paidBy, total, splits }
}

describe('calculateBalances', () => {
  it('matches the spec example: Michael paid ₱15,000, his share is ₱10,000', () => {
    // Michael pays a ₱15,000 hotel split 3 ways (₱5,000 each) and a ₱5,000 dinner
    // paid by John for Michael only.
    const balances = calculateBalances(
      ['michael', 'john', 'sarah'],
      [
        equal('michael', peso(15000), ['michael', 'john', 'sarah']),
        { paidBy: 'john', total: peso(5000), splits: [{ userId: 'michael', amount: peso(5000) }] },
      ],
    )
    const michael = balances.find((b) => b.userId === 'michael')!
    expect(michael.paid).toBe(peso(15000))
    expect(michael.share).toBe(peso(10000))
    expect(michael.net).toBe(peso(5000))
    expect(describeBalance(michael.net)).toBe('receives')
  })

  it('always sums to zero', () => {
    const balances = calculateBalances(
      ['a', 'b', 'c', 'd'],
      [equal('a', 100000, ['a', 'b', 'c']), equal('b', 33333, ['a', 'b', 'c', 'd']), equal('d', 1, ['c'])],
    )
    expect(balances.reduce((sum, b) => sum + b.net, 0)).toBe(0)
  })

  it('counts settlements: paying someone back reduces what you owe', () => {
    const balances = calculateBalances(
      ['michael', 'john'],
      [equal('michael', peso(6000), ['michael', 'john'])],
      [{ fromUserId: 'john', toUserId: 'michael', amount: peso(1000) }],
    )
    expect(balances.find((b) => b.userId === 'john')!.net).toBe(-peso(2000))
    expect(balances.find((b) => b.userId === 'michael')!.net).toBe(peso(2000))
  })

  it('reaches zero once everyone has settled', () => {
    const balances = calculateBalances(
      ['michael', 'john'],
      [equal('michael', peso(6000), ['michael', 'john'])],
      [{ fromUserId: 'john', toUserId: 'michael', amount: peso(3000) }],
    )
    expect(balances.every((b) => b.net === 0)).toBe(true)
    expect(describeBalance(0)).toBe('settled')
  })

  it('lists members with no activity at zero', () => {
    const balances = calculateBalances(['a', 'b', 'quiet'], [equal('a', 1000, ['a', 'b'])])
    expect(balances.find((b) => b.userId === 'quiet')).toMatchObject({ paid: 0, share: 0, net: 0 })
  })
})

describe('simplifyDebts', () => {
  it('matches the spec example', () => {
    const transfers = simplifyDebts([
      { userId: 'michael', net: peso(5000) },
      { userId: 'john', net: -peso(3000) },
      { userId: 'sarah', net: -peso(2000) },
    ])
    expect(transfers).toEqual([
      { from: 'john', to: 'michael', amount: peso(3000) },
      { from: 'sarah', to: 'michael', amount: peso(2000) },
    ])
  })

  it('moves exactly as much as is owed', () => {
    const balances = [
      { userId: 'a', net: 1234 },
      { userId: 'b', net: 5000 },
      { userId: 'c', net: -3333 },
      { userId: 'd', net: -2901 },
    ]
    const transfers = simplifyDebts(balances)
    const credits = balances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0)
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(credits)

    // Applying the transfers zeroes everyone
    const after = new Map(balances.map((b) => [b.userId, b.net]))
    for (const t of transfers) {
      after.set(t.from, after.get(t.from)! + t.amount)
      after.set(t.to, after.get(t.to)! - t.amount)
    }
    expect([...after.values()].every((net) => net === 0)).toBe(true)
  })

  it('prefers exact matches to save payments', () => {
    // Greedy alone needs 4 payments here; matching ₱40 ↔ ₱40 first needs 3.
    const transfers = simplifyDebts([
      { userId: 'c1', net: 60 },
      { userId: 'c2', net: 40 },
      { userId: 'd1', net: -40 },
      { userId: 'd2', net: -30 },
      { userId: 'd3', net: -30 },
    ])
    expect(transfers).toHaveLength(3)
    expect(transfers).toContainEqual({ from: 'd1', to: 'c2', amount: 40 })
  })

  it('never needs more than people − 1 payments', () => {
    const balances = [5, -1, -1, -1, -1, -1, 7, -3, -4].map((net, i) => ({ userId: `u${i}`, net }))
    expect(simplifyDebts(balances).length).toBeLessThanOrEqual(balances.length - 1)
  })

  it('has nothing to do when everyone is settled', () => {
    expect(simplifyDebts([{ userId: 'a', net: 0 }, { userId: 'b', net: 0 }])).toEqual([])
  })

  it('rejects balances that do not sum to zero', () => {
    expect(() => simplifyDebts([{ userId: 'a', net: 5 }, { userId: 'b', net: -4 }])).toThrow()
  })
})
