import { useState } from 'react'
import { useCurrentUser } from '@/hooks/useAuth'
import { DEFAULT_CURRENCY, isCurrencyCode } from '@/lib/currencies'

// Same key as the dashboard's "View in", so both pages agree.
const KEY = 'tripsplit:dashboard-currency'

function read(): string | null {
  try {
    const value = window.localStorage.getItem(KEY)
    return value && isCurrencyCode(value) ? value : null
  } catch {
    return null
  }
}

/**
 * The currency to show totals in: your preferred currency (Settings), unless
 * you picked another with "View in". Picking the preferred one again clears it.
 */
export function useViewCurrency() {
  const { profile } = useCurrentUser()
  const preferred = profile?.preferred_currency ?? DEFAULT_CURRENCY
  const [chosen, setChosen] = useState<string | null>(read)

  function setCurrency(code: string) {
    const next = code === preferred ? null : code
    setChosen(next)
    try {
      if (next) window.localStorage.setItem(KEY, next)
      else window.localStorage.removeItem(KEY)
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  return { currency: chosen ?? preferred, preferred, setCurrency }
}
