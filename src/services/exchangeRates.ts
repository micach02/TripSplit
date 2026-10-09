import { rateToString } from '@/utils/calculations/money'
import { todayIso } from '@/utils/tripStatus'

/**
 * Exchange rates behind a small interface so the source can change without
 * touching the UI.
 *
 *   live   — European Central Bank reference rates via the free Frankfurter
 *            API (no key; only currency codes are sent). Published on working
 *            days; weekends and holidays use the previous working day.
 *   manual — the last rate a traveler typed for a pair, on this device; used
 *            when the live source is unreachable.
 *
 * Rates are always "units of `to` per 1 unit of `from`" as decimal strings.
 */

export interface RateQuote {
  rate: string
  /** The date the rate was published for (yyyy-MM-dd) */
  date: string
  source: 'ecb' | 'manual'
}

export interface ExchangeRateProvider {
  /** `date` (yyyy-MM-dd) asks for that day's rate; omit for the latest. */
  getRate(from: string, to: string, date?: string): Promise<RateQuote | null>
  /** Called after a traveler saves an expense with a rate. */
  remember(from: string, to: string, rate: string): void
}

const API = 'https://api.frankfurter.dev/v1'
const TIMEOUT_MS = 6000

const manualKey = (from: string, to: string) => `tripsplit:rate:${from}:${to}`
const liveKey = (from: string, to: string, date: string) => `tripsplit:ecb:${from}:${to}:${date}`

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or storage disabled — caching is just a convenience.
  }
}

const inFlight = new Map<string, Promise<RateQuote | null>>()

async function fetchLive(from: string, to: string, date: string): Promise<RateQuote | null> {
  const cached = storageGet(liveKey(from, to, date))
  if (cached) return JSON.parse(cached) as RateQuote

  const today = todayIso()
  const endpoint = date >= today ? 'latest' : date
  const response = await fetch(`${API}/${endpoint}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) return null
  const body = (await response.json()) as { date?: string; rates?: Record<string, number> }
  const value = body.rates?.[to]
  if (!value || !body.date) return null

  const quote: RateQuote = { rate: rateToString(value), date: body.date, source: 'ecb' }
  // Past dates never change; "latest" is cached for the rest of today.
  storageSet(liveKey(from, to, date), JSON.stringify(quote))
  return quote
}

export const exchangeRates: ExchangeRateProvider = {
  async getRate(from, to, date = todayIso()) {
    if (from === to) return { rate: '1', date, source: 'ecb' }

    const key = `${from}:${to}:${date}`
    let request = inFlight.get(key)
    if (!request) {
      request = fetchLive(from, to, date).catch(() => null)
      inFlight.set(key, request)
      void request.finally(() => inFlight.delete(key))
    }

    const live = await request
    if (live) return live

    const manual = storageGet(manualKey(from, to))
    return manual ? { rate: manual, date, source: 'manual' } : null
  },

  remember(from, to, rate) {
    if (from !== to) storageSet(manualKey(from, to), rate)
  },
}
