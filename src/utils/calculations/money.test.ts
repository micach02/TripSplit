import { describe, expect, it } from 'vitest'
import {
  allocate,
  convertMinor,
  formatAmount,
  formatMoney,
  parseMoneyInput,
  parseScaled,
  rateToString,
  sumMinor,
  toDecimalString,
  toMajor,
  toMinor,
} from './money'

describe('toMinor', () => {
  it('converts decimals into integer minor units', () => {
    expect(toMinor('1000', 'PHP')).toBe(100000)
    expect(toMinor(1045.5, 'PHP')).toBe(104550)
    expect(toMinor('24.60', 'SGD')).toBe(2460)
    expect(toMinor(250000, 'JPY')).toBe(250000)
  })

  it('is immune to floating-point noise', () => {
    expect(toMinor(0.1 + 0.2, 'PHP')).toBe(30)
    expect(toMinor(1.1 * 3, 'PHP')).toBe(330)
  })

  it('rounds half away from zero like PostgreSQL', () => {
    expect(toMinor('1.005', 'PHP')).toBe(101)
    expect(toMinor('1.004', 'PHP')).toBe(100)
    expect(toMinor('-1.005', 'PHP')).toBe(-101)
    expect(toMinor('12.5', 'JPY')).toBe(13)
    expect(toMinor('12.49', 'JPY')).toBe(12)
  })

  it('handles exponent notation from JavaScript numbers', () => {
    expect(toMinor(1e-7, 'PHP')).toBe(0)
    expect(toMinor(1.5e10, 'PHP')).toBe(1_500_000_000_000)
  })

  it('rejects junk', () => {
    expect(() => toMinor('abc', 'PHP')).toThrow()
    expect(() => toMinor('', 'PHP')).toThrow()
    expect(() => toMinor(Number.NaN, 'PHP')).toThrow()
  })
})

describe('parseScaled', () => {
  it('scales to any precision', () => {
    expect(parseScaled('42.5', 8)).toBe(4_250_000_000n)
    expect(parseScaled('.5', 2)).toBe(50n)
    expect(parseScaled('7.', 2)).toBe(700n)
  })
})

describe('toDecimalString / toMajor', () => {
  it('produces exact strings for the database', () => {
    expect(toDecimalString(104550, 'PHP')).toBe('1045.50')
    expect(toDecimalString(5, 'PHP')).toBe('0.05')
    expect(toDecimalString(-33333, 'PHP')).toBe('-333.33')
    expect(toDecimalString(250000, 'JPY')).toBe('250000')
  })

  it('round-trips through toMinor', () => {
    for (const minor of [0, 1, 99, 100, 33333, 104550, 999_999_999_999_99]) {
      expect(toMinor(toDecimalString(minor, 'PHP'), 'PHP')).toBe(minor)
    }
  })

  it('gives major units for charts', () => {
    expect(toMajor(104550, 'PHP')).toBe(1045.5)
    expect(toMajor(1500, 'KRW')).toBe(1500)
  })

  it('refuses non-integer minor units', () => {
    expect(() => toDecimalString(1.5, 'PHP')).toThrow(TypeError)
  })
})

describe('formatMoney', () => {
  it('formats whole amounts without decimals', () => {
    expect(formatMoney(5_000_000, 'PHP')).toBe('₱50,000')
    expect(formatMoney(3_245_000, 'PHP')).toBe('₱32,450')
  })

  it('keeps decimals when there are cents', () => {
    expect(formatMoney(33333, 'PHP')).toBe('₱333.33')
    expect(formatMoney(104550, 'PHP')).toBe('₱1,045.50')
    expect(formatMoney(2460, 'SGD')).toBe('S$24.60')
  })

  it('can always show decimals', () => {
    expect(formatMoney(5_000_000, 'PHP', { trimZeroDecimals: false })).toBe('₱50,000.00')
  })

  it('formats zero-decimal currencies', () => {
    expect(formatMoney(250_000, 'JPY')).toBe('¥250,000')
    expect(formatMoney(10_000, 'KRW')).toBe('₩10,000')
  })

  it('handles signs for balances', () => {
    expect(formatMoney(-500_000, 'PHP')).toBe('-₱5,000')
    expect(formatMoney(500_000, 'PHP', { signDisplay: 'always' })).toBe('+₱5,000')
    expect(formatMoney(0, 'PHP', { signDisplay: 'always' })).toBe('₱0')
  })

  it('formats database decimals directly', () => {
    expect(formatAmount(50000, 'PHP')).toBe('₱50,000')
    expect(formatAmount('1045.50', 'PHP')).toBe('₱1,045.50')
  })
})

describe('allocate', () => {
  it('splits ₱1,000 three ways without losing a centavo', () => {
    const parts = allocate(100000, [1, 1, 1])
    expect(parts).toEqual([33333, 33333, 33334])
    expect(sumMinor(parts)).toBe(100000)
  })

  it('splits evenly when it can', () => {
    expect(allocate(200000, [1, 1, 1, 1])).toEqual([50000, 50000, 50000, 50000])
  })

  it('splits by percentage', () => {
    expect(allocate(200000, [50, 25, 15, 10])).toEqual([100000, 50000, 30000, 20000])
  })

  it('splits by shares, giving the leftover unit to the largest remainder', () => {
    // ₱1,045.50 at 2:1:1
    expect(allocate(104550, [2, 1, 1])).toEqual([52275, 26137, 26138])
  })

  it('accepts decimal weights', () => {
    const parts = allocate(100000, ['33.33', '33.33', '33.34'])
    expect(sumMinor(parts)).toBe(100000)
    expect(parts).toEqual([33330, 33330, 33340])
  })

  it('gives nothing to zero weights', () => {
    expect(allocate(1001, [1, 0, 1])).toEqual([500, 0, 501])
  })

  it('preserves the sign of negative totals', () => {
    expect(allocate(-100000, [1, 1, 1])).toEqual([-33333, -33333, -33334])
  })

  it('always sums to the total', () => {
    const weights = [3, 7, 11, 13, 17]
    for (let total = 0; total < 500; total += 7) {
      expect(sumMinor(allocate(total, weights))).toBe(total)
    }
  })

  it('rejects invalid weights', () => {
    expect(() => allocate(100, [])).toThrow()
    expect(() => allocate(100, [0, 0])).toThrow()
    expect(() => allocate(100, [1, -1])).toThrow()
  })
})

describe('convertMinor', () => {
  it('converts SGD to PHP', () => {
    // S$24.60 × 42.50 = ₱1,045.50
    expect(convertMinor(2460, 'SGD', 'PHP', '42.5')).toBe(104550)
  })

  it('converts into a zero-decimal currency with rounding', () => {
    // ₱123.45 × 2.581 = ¥318.62445 → ¥319
    expect(convertMinor(12345, 'PHP', 'JPY', '2.581')).toBe(319)
  })

  it('converts out of a zero-decimal currency', () => {
    // ¥1,000 × 0.3875 = ₱387.50
    expect(convertMinor(1000, 'JPY', 'PHP', 0.3875)).toBe(38750)
  })

  it('rounds exact halves away from zero', () => {
    // ₱0.01 × 50 = ¥0.5 → ¥1
    expect(convertMinor(1, 'PHP', 'JPY', 50)).toBe(1)
  })

  it('uses the rate at 8 decimal places, like numeric(18,8)', () => {
    // 0.123456785 → 0.12345679
    expect(convertMinor(100_000_000, 'USD', 'PHP', '0.123456785')).toBe(12_345_679)
  })

  it('ignores the rate for same-currency amounts', () => {
    expect(convertMinor(5000, 'PHP', 'PHP', 3)).toBe(5000)
  })

  it('rejects non-positive rates', () => {
    expect(() => convertMinor(100, 'SGD', 'PHP', 0)).toThrow()
    expect(() => convertMinor(100, 'SGD', 'PHP', '-1')).toThrow()
  })
})

describe('rateToString', () => {
  it('writes API rates as plain decimals with at most 8 places', () => {
    expect(rateToString(49.146)).toBe('49.146')
    expect(rateToString(0.00072)).toBe('0.00072')
    expect(rateToString(1047.97)).toBe('1047.97')
    expect(rateToString(150)).toBe('150')
    expect(rateToString(0.0123456789)).toBe('0.01234568')
  })

  it('rejects non-positive rates', () => {
    expect(() => rateToString(0)).toThrow()
  })
})

describe('parseMoneyInput', () => {
  it('accepts typical typed amounts', () => {
    expect(parseMoneyInput('1,250.50', 'PHP')).toEqual({ ok: true, minor: 125050 })
    expect(parseMoneyInput('₱ 300', 'PHP')).toEqual({ ok: true, minor: 30000 })
    expect(parseMoneyInput('.5', 'PHP')).toEqual({ ok: true, minor: 50 })
    expect(parseMoneyInput('1500', 'JPY')).toEqual({ ok: true, minor: 1500 })
  })

  it('rejects bad input with a friendly message', () => {
    expect(parseMoneyInput('', 'PHP')).toMatchObject({ ok: false, error: 'Enter an amount.' })
    expect(parseMoneyInput('abc', 'PHP')).toMatchObject({ ok: false })
    expect(parseMoneyInput('-5', 'PHP')).toMatchObject({ ok: false })
    expect(parseMoneyInput('12.345', 'PHP')).toMatchObject({ ok: false, error: 'Use at most 2 decimal places.' })
    expect(parseMoneyInput('12.5', 'JPY')).toMatchObject({ ok: false, error: "JPY amounts can't have decimals." })
    expect(parseMoneyInput('1000000000000', 'PHP')).toMatchObject({ ok: false, error: 'That amount is too large.' })
  })
})
