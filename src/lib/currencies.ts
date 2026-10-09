/**
 * Supported currencies. Mirrors the `public.currencies` table — keep in sync.
 * `decimals` is the number of minor-unit digits (JPY and KRW have none).
 */
export interface Currency {
  code: string
  name: string
  symbol: string
  decimals: number
  flag: string
}

export const CURRENCIES = {
  PHP: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2, flag: '🇵🇭' },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, flag: '🇸🇬' },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, flag: '🇺🇸' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, flag: '🇪🇺' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, flag: '🇯🇵' },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0, flag: '🇰🇷' },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2, flag: '🇲🇾' },
} as const satisfies Record<string, Currency>

export type CurrencyCode = keyof typeof CURRENCIES

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

export const DEFAULT_CURRENCY: CurrencyCode = 'PHP'

export function isCurrencyCode(code: string): code is CurrencyCode {
  return Object.hasOwn(CURRENCIES, code)
}

/** Looks up a currency; unknown codes fall back to a 2-decimal currency shown by its code. */
export function getCurrency(code: string): Currency {
  if (isCurrencyCode(code)) return CURRENCIES[code]
  return { code, name: code, symbol: `${code} `, decimals: 2, flag: '🏳️' }
}
