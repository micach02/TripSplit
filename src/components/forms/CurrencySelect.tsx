import type { ReactNode, SelectHTMLAttributes } from 'react'
import { SelectField } from '@/components/forms/SelectField'
import { CURRENCIES, CURRENCY_CODES } from '@/lib/currencies'

interface CurrencySelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  containerClassName?: string
}

export function CurrencySelect(props: CurrencySelectProps) {
  return (
    <SelectField {...props}>
      {CURRENCY_CODES.map((code) => {
        const currency = CURRENCIES[code]
        return (
          <option key={code} value={code}>
            {`${currency.flag}  ${code} — ${currency.name} (${currency.symbol})`}
          </option>
        )
      })}
    </SelectField>
  )
}
