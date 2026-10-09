import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { controlClasses, describedBy } from '@/components/forms/controlStyles'
import { FormField } from '@/components/forms/FormField'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  containerClassName?: string
}

export function SelectField({ label, error, hint, containerClassName, id, className, children, ...selectProps }: SelectFieldProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <FormField id={selectId} label={label} error={error} hint={hint} className={containerClassName}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, { error, hint })}
          className={controlClasses(Boolean(error), `appearance-none pr-10 ${className ?? ''}`)}
          {...selectProps}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>
    </FormField>
  )
}
