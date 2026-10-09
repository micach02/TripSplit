import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { controlClasses, describedBy } from '@/components/forms/controlStyles'
import { FormField } from '@/components/forms/FormField'

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  containerClassName?: string
}

export function TextareaField({ label, error, hint, containerClassName, id, className, rows = 3, ...props }: TextareaFieldProps) {
  const autoId = useId()
  const textareaId = id ?? autoId
  return (
    <FormField id={textareaId} label={label} error={error} hint={hint} className={containerClassName}>
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(textareaId, { error, hint })}
        className={controlClasses(Boolean(error), `h-auto py-3 leading-relaxed ${className ?? ''}`)}
        {...props}
      />
    </FormField>
  )
}
