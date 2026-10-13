import { describe, expect, it } from 'vitest'
import { parseReceiptText } from '@/utils/receiptParser'

const TODAY = '2026-10-13'

describe('parseReceiptText', () => {
  it('reads a typical restaurant receipt', () => {
    const text = `KERMIT SIARGAO
Tourism Rd, General Luna
TIN 123-456-789-000
Table 7      Server: Jo
10/09/2026 19:42
2x Wood-fired pizza   900.00
1x Kinilaw            380.00
3x Mango shake        360.00
SUBTOTAL            1,640.00
SERVICE CHARGE         60.00
TOTAL               1,700.00
CASH                2,000.00
CHANGE                300.00
Thank you!`
    expect(parseReceiptText(text, TODAY)).toEqual({ amount: '1700.00', date: '2026-10-09', merchant: 'Kermit Siargao' })
  })

  it('prefers the grand total / amount due over other totals', () => {
    const text = `SM SUPERMARKET
Oct 3, 2026
Total items: 12
TOTAL 2,150.25
VAT 12% 230.38
GRAND TOTAL 2,200.50`
    expect(parseReceiptText(text, TODAY)).toMatchObject({ amount: '2200.50', date: '2026-10-03', merchant: 'Sm Supermarket' })
  })

  it('finds a total written on the next line', () => {
    const text = `Bakery
AMOUNT DUE
P 300.00
2026-09-28`
    expect(parseReceiptText(text, TODAY)).toMatchObject({ amount: '300.00', date: '2026-09-28', merchant: 'Bakery' })
  })

  it('reads day-first dates when month-first can’t be right', () => {
    expect(parseReceiptText('Total 50.00\n25/09/2026', TODAY).date).toBe('2026-09-25')
    expect(parseReceiptText('Total 50.00\n9-Oct-2026', TODAY).date).toBe('2026-10-09')
  })

  it('ignores future and very old dates, and returns nulls when unsure', () => {
    expect(parseReceiptText('TOTAL 99.00\n12/25/2026', TODAY).date).toBeNull()
    expect(parseReceiptText('TOTAL 99.00\n01/01/2019', TODAY).date).toBeNull()
    expect(parseReceiptText('blurry ### ~~', TODAY)).toEqual({ amount: null, date: null, merchant: null })
    expect(parseReceiptText('', TODAY)).toEqual({ amount: null, date: null, merchant: null })
  })
})
