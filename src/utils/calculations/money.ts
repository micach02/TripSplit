import { getCurrency } from '@/lib/currencies'

/**
 * Money helpers.
 *
 * All arithmetic happens on integer *minor units* (centavos, cents, yen, …) so
 * values never pick up floating-point drift. Decimals appear only at the edges:
 * parsing user input or database numerics, formatting for display, and writing
 * decimal strings back to the database.
 *
 * Rounding is always "half away from zero" — the same as PostgreSQL's round()
 * for numeric — so the app and the database always agree to the minor unit.
 */

/** Exchange rates are stored as numeric(18,8). */
export const RATE_DECIMALS = 8
/** Precision used when comparing split weights (percentages, shares). */
const WEIGHT_DECIMALS = 6
/** Largest amount the database accepts: numeric(14,2). */
const MAX_MAJOR_UNITS = 999_999_999_999n

const DECIMAL_PATTERN = /^([+-])?(\d*)(?:\.(\d*))?$/

export function currencyDecimals(currency: string): number {
  return getCurrency(currency).decimals
}

function assertMinor(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Money amounts must be integer minor units, got ${value}`)
  }
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Amount is too large')
  }
  return Number(value)
}

/** Expands a JS number into a plain decimal string, e.g. 1e-7 → "0.0000001". */
function numberToDecimalString(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite number: ${value}`)
  const text = String(value)
  if (!/e/i.test(text)) return text

  const [mantissa, exponentText] = text.toLowerCase().split('e')
  const negative = mantissa.startsWith('-')
  const [intDigits, fracDigits = ''] = mantissa.replace('-', '').split('.')
  const digits = intDigits + fracDigits
  const point = intDigits.length + Number(exponentText)

  let plain: string
  if (point <= 0) plain = `0.${'0'.repeat(-point)}${digits}`
  else if (point >= digits.length) plain = digits + '0'.repeat(point - digits.length)
  else plain = `${digits.slice(0, point)}.${digits.slice(point)}`
  return negative ? `-${plain}` : plain
}

/**
 * Parses a decimal into a BigInt scaled by 10^scale, rounding half away from zero.
 * `parseScaled('1.005', 2) === 101n`
 *
 * Numbers are read through their shortest round-trip text ("0.1", not
 * 0.1000000000000000055…), which is exactly what PostgREST sent.
 */
export function parseScaled(value: string | number, scale: number): bigint {
  const text = typeof value === 'number' ? numberToDecimalString(value) : value.trim()
  const match = DECIMAL_PATTERN.exec(text)
  if (!match || (!match[2] && !match[3])) throw new RangeError(`Invalid decimal: "${value}"`)

  const [, sign, intPart, fracPart = ''] = match
  let magnitude = BigInt((intPart || '0') + fracPart.slice(0, scale).padEnd(scale, '0'))
  if ((fracPart[scale] ?? '0') >= '5') magnitude += 1n
  return sign === '-' ? -magnitude : magnitude
}

function divideRoundHalfAwayFromZero(numerator: bigint, divisor: bigint): bigint {
  const negative = numerator < 0n
  const magnitude = negative ? -numerator : numerator
  let quotient = magnitude / divisor
  if ((magnitude % divisor) * 2n >= divisor) quotient += 1n
  return negative ? -quotient : quotient
}

/** Decimal (database numeric, typed input) → integer minor units. */
export function toMinor(value: string | number, currency: string): number {
  return toSafeNumber(parseScaled(value, currencyDecimals(currency)))
}

/** Integer minor units → exact decimal string for the database, e.g. 104550 → "1045.50". */
export function toDecimalString(minor: number, currency: string): string {
  assertMinor(minor)
  const decimals = currencyDecimals(currency)
  const digits = Math.abs(minor).toString().padStart(decimals + 1, '0')
  const whole = decimals ? digits.slice(0, -decimals) : digits
  const fraction = decimals ? `.${digits.slice(-decimals)}` : ''
  return `${minor < 0 ? '-' : ''}${whole}${fraction}`
}

/** Integer minor units → major units as a JS number. For charts only — never for arithmetic. */
export function toMajor(minor: number, currency: string): number {
  assertMinor(minor)
  return minor / 10 ** currencyDecimals(currency)
}

export function sumMinor(values: readonly number[]): number {
  let total = 0
  for (const value of values) {
    assertMinor(value)
    total += value
  }
  assertMinor(total)
  return total
}

export interface FormatMoneyOptions {
  /** 'always' adds "+" to positive amounts (e.g. balances). Default 'auto'. */
  signDisplay?: 'auto' | 'always'
  /** Drop ".00" from whole amounts: "₱50,000" rather than "₱50,000.00". Default true. */
  trimZeroDecimals?: boolean
}

const numberFormatters = new Map<number, Intl.NumberFormat>()

function numberFormatter(fractionDigits: number): Intl.NumberFormat {
  let formatter = numberFormatters.get(fractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    numberFormatters.set(fractionDigits, formatter)
  }
  return formatter
}

/** Formats integer minor units: formatMoney(3333, 'PHP') → "₱33.33". */
export function formatMoney(minor: number, currency: string, options: FormatMoneyOptions = {}): string {
  assertMinor(minor)
  const { signDisplay = 'auto', trimZeroDecimals = true } = options
  const { symbol, decimals } = getCurrency(currency)
  const factor = 10 ** decimals
  const magnitude = Math.abs(minor)
  const fractionDigits = trimZeroDecimals && magnitude % factor === 0 ? 0 : decimals
  const body = numberFormatter(fractionDigits).format(magnitude / factor)
  const sign = minor < 0 ? '-' : minor > 0 && signDisplay === 'always' ? '+' : ''
  return `${sign}${symbol}${body}`
}

/** Formats a decimal straight from the database: formatAmount(50000, 'PHP') → "₱50,000". */
export function formatAmount(value: string | number, currency: string, options?: FormatMoneyOptions): string {
  return formatMoney(toMinor(value, currency), currency, options)
}

/**
 * Splits `totalMinor` into integer parts proportional to `weights`; the parts
 * always add up to exactly the total (largest-remainder method).
 *
 * Leftover minor units go to the largest remainders, ties to the later
 * entries — so ₱1,000 ÷ 3 → ₱333.33, ₱333.33, ₱333.34.
 *
 * Weights can be decimals (percentages like 33.33, shares like 1.5).
 */
export function allocate(totalMinor: number, weights: ReadonlyArray<number | string>): number[] {
  assertMinor(totalMinor)
  if (weights.length === 0) throw new RangeError('allocate() needs at least one weight')

  const scaled = weights.map((weight) => {
    const value = parseScaled(weight, WEIGHT_DECIMALS)
    if (value < 0n) throw new RangeError('Weights cannot be negative')
    return value
  })
  const weightSum = scaled.reduce((sum, weight) => sum + weight, 0n)
  if (weightSum === 0n) throw new RangeError('At least one weight must be greater than zero')

  const total = BigInt(Math.abs(totalMinor))
  const parts = scaled.map((weight) => (total * weight) / weightSum)
  const remainders = scaled.map((weight) => (total * weight) % weightSum)
  let leftover = total - parts.reduce((sum, part) => sum + part, 0n)

  const order = parts
    .map((_, index) => index)
    .sort((a, b) => (remainders[a] === remainders[b] ? b - a : remainders[b] > remainders[a] ? 1 : -1))
  for (const index of order) {
    if (leftover === 0n) break
    parts[index] += 1n
    leftover -= 1n
  }

  const sign = totalMinor < 0 ? -1 : 1
  return parts.map((part) => (part === 0n ? 0 : sign * Number(part)))
}

/**
 * Converts minor units between currencies: amount × rate, rounded half away
 * from zero to the target currency's decimals. Matches the database trigger's
 * round(amount * exchange_rate, decimals) exactly.
 *
 * `rate` is units of `to` per 1 unit of `from`, used to 8 decimal places.
 */
export function convertMinor(amountMinor: number, from: string, to: string, rate: string | number): number {
  assertMinor(amountMinor)
  if (from === to) return amountMinor

  const rateScaled = parseScaled(rate, RATE_DECIMALS)
  if (rateScaled <= 0n) throw new RangeError('Exchange rate must be greater than zero')

  const shift = currencyDecimals(from) + RATE_DECIMALS - currencyDecimals(to)
  const product = BigInt(amountMinor) * rateScaled
  return toSafeNumber(divideRoundHalfAwayFromZero(product, 10n ** BigInt(shift)))
}

/**
 * A rate (e.g. from a rates API) as a plain decimal string with at most 8
 * decimal places — the precision the database stores: 49.146 → "49.146".
 */
export function rateToString(rate: number | string): string {
  const scaled = parseScaled(rate, RATE_DECIMALS)
  if (scaled <= 0n) throw new RangeError('Exchange rate must be greater than zero')
  const digits = scaled.toString().padStart(RATE_DECIMALS + 1, '0')
  const whole = digits.slice(0, -RATE_DECIMALS)
  const fraction = digits.slice(-RATE_DECIMALS).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

export type MoneyInputResult = { ok: true; minor: number } | { ok: false; error: string }

/**
 * Validates an amount someone typed: "1,250.50", "₱ 300", "12.5".
 * Rejects junk, negatives, and more decimals than the currency allows.
 */
export function parseMoneyInput(input: string, currency: string): MoneyInputResult {
  const { decimals, symbol } = getCurrency(currency)
  const cleaned = input.replace(symbol.trim(), '').replace(/[\s,]/g, '')

  if (cleaned === '') return { ok: false, error: 'Enter an amount.' }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { ok: false, error: 'Enter a valid amount.' }

  const fraction = cleaned.split('.')[1] ?? ''
  if (fraction.length > decimals) {
    return {
      ok: false,
      error: decimals === 0 ? `${currency} amounts can't have decimals.` : `Use at most ${decimals} decimal places.`,
    }
  }

  const scaled = parseScaled(cleaned, decimals)
  if (scaled > MAX_MAJOR_UNITS * 10n ** BigInt(decimals)) {
    return { ok: false, error: 'That amount is too large.' }
  }
  return { ok: true, minor: Number(scaled) }
}
