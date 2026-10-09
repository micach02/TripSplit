import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { controlClasses, describedBy } from '@/components/forms/controlStyles'
import { FormField } from '@/components/forms/FormField'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  labelAction?: ReactNode
  containerClassName?: string
}

export function TextField({
  label,
  error,
  hint,
  labelAction,
  containerClassName,
  id,
  className,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FormField id={inputId} label={label} error={error} hint={hint} labelAction={labelAction} className={containerClassName}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, { error, hint })}
        className={controlClasses(Boolean(error), className)}
        {...inputProps}
      />
    </FormField>
  )
}
