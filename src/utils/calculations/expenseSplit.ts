import { allocate, parseMoneyInput, parseScaled, toDecimalString } from '@/utils/calculations/money'

/**
 * Turns a split method plus per-person inputs into exact per-person shares.
 *
 * Shares are always computed in the TRIP currency from the converted total,
 * with largest-remainder allocation, so they add up to the converted amount
 * to the minor unit. Inputs are validated with the same rules the database
 * enforces in tripsplit.save_expense.
 */

export type SplitMethod = 'equal' | 'custom' | 'percentage' | 'shares'

export interface SplitParticipantInput {
  userId: string
  /** What the person typed: an amount (custom), a percentage, or a share count. Ignored for equal. */
  value: string
}

export interface ComputedSplit {
  userId: string
  /** Stored input: decimal string, or null for equal splits. */
  value: string | null
  /** Share of the converted total, in trip-currency minor units. */
  amount: number
}

export interface SplitCalculation {
  ok: boolean
  /** Why the split can't be saved yet (null when ok). */
  error: string | null
  /** Per-person shares, present whenever they can be computed. */
  splits: ComputedSplit[]
  /**
   * Live progress for the form footer:
   *  custom      → minor units of the expense currency assigned / still to assign
   *  percentage  → hundredths of a percent assigned / still to assign (10000 = 100%)
   *  equal/shares → 0
   */
  assigned: number
  remaining: number
}

export interface SplitParams {
  method: SplitMethod
  participants: readonly SplitParticipantInput[]
  /** Converted total in trip-currency minor units. */
  totalMinor: number
  /** Original amount in expense-currency minor units (what custom amounts must add up to). */
  originalMinor: number
  expenseCurrency: string
}

const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/
const SHARES_PATTERN = /^\d{1,6}(\.\d{1,2})?$/
const FULL_PERCENT = 10_000 // hundredths

function fail(error: string, assigned = 0, remaining = 0, splits: ComputedSplit[] = []): SplitCalculation {
  return { ok: false, error, splits, assigned, remaining }
}

export function calculateSplits({
  method,
  participants,
  totalMinor,
  originalMinor,
  expenseCurrency,
}: SplitParams): SplitCalculation {
  if (participants.length === 0) return fail('Choose at least one person to share this expense.')
  if (totalMinor <= 0 || originalMinor <= 0) return fail('Enter an amount first.')

  if (method === 'equal') {
    const amounts = allocate(totalMinor, participants.map(() => 1))
    return {
      ok: true,
      error: null,
      splits: participants.map((p, i) => ({ userId: p.userId, value: null, amount: amounts[i] })),
      assigned: 0,
      remaining: 0,
    }
  }

  if (method === 'custom') {
    const values: number[] = []
    for (const participant of participants) {
      const text = participant.value.trim()
      if (text === '') {
        values.push(0)
        continue
      }
      const parsed = parseMoneyInput(text, expenseCurrency)
      if (!parsed.ok) return fail('Check the amounts — one of them isn’t a valid number.')
      values.push(parsed.minor)
    }
    const assigned = values.reduce((sum, value) => sum + value, 0)
    const remaining = originalMinor - assigned
    if (remaining !== 0 || assigned === 0) {
      return fail('The amounts must add up to the total.', assigned, remaining)
    }
    const amounts = allocate(totalMinor, values)
    return {
      ok: true,
      error: null,
      splits: participants.map((p, i) => ({
        userId: p.userId,
        value: toDecimalString(values[i], expenseCurrency),
        amount: amounts[i],
      })),
      assigned,
      remaining: 0,
    }
  }

  if (method === 'percentage') {
    const hundredths: number[] = []
    for (const participant of participants) {
      const text = participant.value.trim() || '0'
      if (!PERCENT_PATTERN.test(text)) return fail('Use percentages like 25 or 33.33.')
      const value = Number(parseScaled(text, 2))
      if (value > FULL_PERCENT) return fail('A percentage can’t be more than 100%.')
      hundredths.push(value)
    }
    const assigned = hundredths.reduce((sum, value) => sum + value, 0)
    const remaining = FULL_PERCENT - assigned
    if (remaining !== 0) return fail('Percentages must add up to 100%.', assigned, remaining)
    const amounts = allocate(totalMinor, hundredths)
    return {
      ok: true,
      error: null,
      splits: participants.map((p, i) => ({
        userId: p.userId,
        value: (hundredths[i] / 100).toFixed(2),
        amount: amounts[i],
      })),
      assigned,
      remaining: 0,
    }
  }

  // shares
  const shares: string[] = []
  for (const participant of participants) {
    const text = participant.value.trim()
    if (!SHARES_PATTERN.test(text) || parseScaled(text, 2) <= 0n) {
      return fail('Give everyone at least one share (or remove them from the split).')
    }
    shares.push((Number(parseScaled(text, 2)) / 100).toString())
  }
  const amounts = allocate(totalMinor, shares)
  return {
    ok: true,
    error: null,
    splits: participants.map((p, i) => ({ userId: p.userId, value: shares[i], amount: amounts[i] })),
    assigned: 0,
    remaining: 0,
  }
}

/** Sensible starting inputs when someone switches split method. */
export function defaultSplitValues(
  method: SplitMethod,
  count: number,
  originalMinor: number,
  expenseCurrency: string,
): string[] {
  if (count === 0) return []
  switch (method) {
    case 'equal':
      return Array.from({ length: count }, () => '')
    case 'shares':
      return Array.from({ length: count }, () => '1')
    case 'percentage':
      return allocate(FULL_PERCENT, Array.from({ length: count }, () => 1)).map((value) => (value / 100).toString())
    case 'custom':
      return originalMinor > 0
        ? allocate(originalMinor, Array.from({ length: count }, () => 1)).map((value) =>
            toDecimalString(value, expenseCurrency),
          )
        : Array.from({ length: count }, () => '')
  }
}

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  equal: 'Equally',
  custom: 'Amounts',
  percentage: 'Percent',
  shares: 'Shares',
}
