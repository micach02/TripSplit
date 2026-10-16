import { ArrowLeftRight } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import type { TripMoney } from '@/hooks/useDisplayCurrency'
import { CURRENCIES, CURRENCY_CODES } from '@/lib/currencies'
import { formatDate } from '@/utils/format'

interface CurrencyViewPickerProps {
  value: string
  onChange: (currency: string) => void
  /** The currency amounts are naturally in, labelled e.g. "PHP (trip)" */
  homeCurrency: string
  homeLabel: string
  loading?: boolean
}

/** "View in [USD ▾]" — a display-only currency switch. */
export function CurrencyViewPicker({ value, onChange, homeCurrency, homeLabel, loading = false }: CurrencyViewPickerProps) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-xs font-semibold text-slate-600">
      <ArrowLeftRight className="size-3.5" aria-hidden />
      <span>View in</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-full border-0 bg-surface px-2 text-xs font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
        aria-label="Currency to view amounts in"
      >
        {CURRENCY_CODES.map((code) => (
          <option key={code} value={code}>
            {code === homeCurrency ? `${code} (${homeLabel})` : code}
          </option>
        ))}
      </select>
      {loading && <Spinner className="size-3.5 text-primary-600" />}
    </label>
  )
}

interface DisplayCurrencyPickerProps {
  money: TripMoney
  requested: string
  onChange: (currency: string) => void
}

/** The trip's "View in" switch: converts a trip's figures for display only. */
export function DisplayCurrencyPicker({ money, requested, onChange }: DisplayCurrencyPickerProps) {
  return (
    <CurrencyViewPicker
      value={requested}
      onChange={onChange}
      homeCurrency={money.tripCurrency}
      homeLabel="trip"
      loading={money.status === 'loading'}
    />
  )
}

/** One line explaining a converted view, or why conversion failed. */
export function ConversionNote({ money, requested }: { money: TripMoney; requested: string }) {
  if (money.status === 'unavailable') {
    return (
      <p className="text-xs text-orange-700" role="status">
        Couldn’t load exchange rates — showing amounts in {money.tripCurrency}.
      </p>
    )
  }
  if (!money.converted || !money.quote) return null
  const symbol = CURRENCIES[requested as keyof typeof CURRENCIES]?.symbol.trim() ?? requested
  return (
    <p className="text-xs text-slate-500">
      Shown in {requested} at 1 {money.tripCurrency} = {symbol}
      {money.quote.rate} ({money.quote.source === 'ecb' ? `ECB, ${formatDate(money.quote.date)}` : 'your last rate'}).
      Amounts are still recorded in {money.tripCurrency}.
    </p>
  )
}
