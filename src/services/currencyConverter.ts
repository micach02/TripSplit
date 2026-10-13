import { exchangeRates } from '@/services/exchangeRates'
import { convertMinor } from '@/utils/calculations/money'

/** Converts minor units of `from` into the target currency; null when no rate could be loaded. */
export type Convert = (minor: number, from: string) => number | null

/**
 * One rate per foreign currency (today's ECB rate, or the last one you used
 * when offline), fetched in parallel.
 */
export async function makeConverter(
  currencies: Iterable<string>,
  target: string,
): Promise<{ convert: Convert; missing: string[] }> {
  const foreign = [...new Set(currencies)].filter((code) => code !== target)
  const quotes = await Promise.all(foreign.map((code) => exchangeRates.getRate(code, target)))
  const rates = new Map(foreign.map((code, index) => [code, quotes[index]?.rate ?? null]))
  return {
    convert: (minor, from) => {
      if (from === target) return minor
      const rate = rates.get(from)
      return rate ? convertMinor(minor, from, target, rate) : null
    },
    missing: foreign.filter((code) => !rates.get(code)),
  }
}
