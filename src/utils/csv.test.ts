import { describe, expect, it } from 'vitest'
import { slugify, toCsv } from '@/utils/csv'

describe('toCsv', () => {
  it('joins rows and quotes only when needed', () => {
    expect(
      toCsv([
        ['Date', 'Description', 'Amount'],
        ['2026-10-09', 'Dinner, drinks', '1700.00'],
        ['2026-10-10', 'The "good" pizza', 450],
        ['2026-10-11', 'Line\nbreak', null],
      ]),
    ).toBe(
      'Date,Description,Amount\r\n2026-10-09,"Dinner, drinks",1700.00\r\n2026-10-10,"The ""good"" pizza",450\r\n2026-10-11,"Line\nbreak",',
    )
  })

  it('defuses text a spreadsheet would run as a formula, but not negative amounts', () => {
    expect(toCsv([['=HYPERLINK("x")', '+cmd', '@sum', '-x', '-120.50', -5]])).toBe(
      `"'=HYPERLINK(""x"")",'+cmd,'@sum,'-x,-120.50,-5`,
    )
  })

  it('keeps ₱ and emoji as they are', () => {
    expect(toCsv([['₱1,700', '🛒 Groceries']])).toBe('"₱1,700",🛒 Groceries')
  })
})

describe('slugify', () => {
  it('makes file-name-safe slugs', () => {
    expect(slugify('Groceries & Food')).toBe('groceries-food')
    expect(slugify('Siargao Surf Trip 2026')).toBe('siargao-surf-trip-2026')
    expect(slugify('!!!')).toBe('export')
  })
})
