import { describe, expect, it } from 'vitest'
import { formatCompact, niceScale } from './chartTheme'

describe('niceScale', () => {
  it('rounds the axis maximum up to a clean number', () => {
    expect(niceScale(8400)).toEqual({ max: 10000, ticks: [0, 2500, 5000, 7500, 10000] })
    expect(niceScale(4450)).toEqual({ max: 5000, ticks: [0, 1000, 2000, 3000, 4000, 5000] })
    expect(niceScale(160.75)).toEqual({ max: 200, ticks: [0, 50, 100, 150, 200] })
    expect(niceScale(2.2).max).toBe(2.5)
  })

  it('handles an empty chart', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] })
  })
})

describe('formatCompact', () => {
  it('formats axis ticks briefly', () => {
    expect(formatCompact(2500, '₱')).toBe('₱2.5K')
    expect(formatCompact(1200000, '¥')).toBe('¥1.2M')
    expect(formatCompact(0, '$')).toBe('$0')
  })
})
