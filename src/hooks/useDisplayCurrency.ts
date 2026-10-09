import { useCallback, useMemo, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { isCurrencyCode } from '@/lib/currencies'
import { exchangeRates, type RateQuote } from '@/services/exchangeRates'
import { convertMinor, formatMoney, type FormatMoneyOptions } from '@/utils/calculations/money'

/**
 * How a trip's money is shown. Amounts are stored in the trip currency; this
 * converts them for display only, at the latest ECB rate.
 */
export interface TripMoney {
  /** The currency amounts are shown in */
  currency: string
  tripCurrency: string
  /** True when amounts are converted out of the trip currency */
  converted: boolean
  /** Rate trip → display currency, when converted */
  quote: RateQuote | null
  status: 'ready' | 'loading' | 'unavailable'
  /** Trip-currency minor units → minor units of the display currency */
  convert: (minor: number) => number
  format: (minor: number, options?: FormatMoneyOptions) => string
}

const storageKey = (tripId: string) => `tripsplit:display-currency:${tripId}`

function readChoice(tripId: string): string | null {
  try {
    const value = window.localStorage.getItem(storageKey(tripId))
    return value && isCurrencyCode(value) ? value : null
  } catch {
    return null
  }
}

export function makeTripMoney(tripCurrency: string, display: string, quote: RateQuote | null, loading: boolean): TripMoney {
  const converted = display !== tripCurrency && quote !== null
  const currency = converted ? display : tripCurrency
  const convert = (minor: number) => (converted && quote ? convertMinor(minor, tripCurrency, display, quote.rate) : minor)
  return {
    currency,
    tripCurrency,
    converted,
    quote: converted ? quote : null,
    status: display === tripCurrency || converted ? 'ready' : loading ? 'loading' : 'unavailable',
    convert,
    format: (minor, options) => formatMoney(convert(minor), currency, options),
  }
}

export function useDisplayCurrency(tripId: string, tripCurrency: string) {
  const [choice, setChoice] = useState<{ tripId: string; currency: string | null }>(() => ({
    tripId,
    currency: readChoice(tripId),
  }))
  // A stored choice belongs to one trip; re-read when the trip changes.
  const requested = (choice.tripId === tripId ? choice.currency : readChoice(tripId)) ?? tripCurrency

  const load = useCallback(async () => {
    const quote = requested === tripCurrency ? null : await exchangeRates.getRate(tripCurrency, requested)
    return { from: tripCurrency, to: requested, quote }
  }, [tripCurrency, requested])
  const { data, loading } = useAsync(load)
  // Ignore a quote for a pair we're no longer showing.
  const quote = data && data.from === tripCurrency && data.to === requested ? data.quote : null

  const money = useMemo(
    () => makeTripMoney(tripCurrency, requested, quote, loading),
    [tripCurrency, requested, quote, loading],
  )

  const setDisplayCurrency = useCallback(
    (currency: string) => {
      setChoice({ tripId, currency })
      try {
        window.localStorage.setItem(storageKey(tripId), currency)
      } catch {
        // Remembering the choice is a convenience only.
      }
    },
    [tripId],
  )

  return { money, requested, setDisplayCurrency }
}
