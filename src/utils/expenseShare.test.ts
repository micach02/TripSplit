import { describe, expect, it } from 'vitest'
import { yourShare } from './expenseShare'

const dinner = {
  paid_by: 'michael',
  converted_amount: 2500,
  expense_splits: [
    { user_id: 'michael', amount: 625 },
    { user_id: 'john', amount: 625 },
    { user_id: 'sarah', amount: 625 },
    { user_id: 'anna', amount: 625 },
  ],
}

describe('yourShare', () => {
  it('shows what the payer lent to everyone else', () => {
    expect(yourShare(dinner, 'michael', 'PHP')).toEqual({ tone: 'positive', amount: 187500, text: 'You lent ₱1,875' })
  })

  it('shows what a participant owes', () => {
    expect(yourShare(dinner, 'john', 'PHP')).toEqual({ tone: 'negative', amount: 62500, text: 'You owe ₱625' })
  })

  it('is empty for people who are not involved', () => {
    expect(yourShare(dinner, 'paolo', 'PHP')).toBeNull()
  })

  it('is empty when you paid only for yourself', () => {
    expect(yourShare({ paid_by: 'anna', converted_amount: 300, expense_splits: [{ user_id: 'anna', amount: 300 }] }, 'anna', 'PHP')).toBeNull()
  })
})
