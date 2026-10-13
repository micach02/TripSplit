import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { controlClasses, describedBy } from '@/components/forms/controlStyles'
import { FormField } from '@/components/forms/FormField'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  labelAction?: ReactNode
  containerClassName?: string
}

export function PasswordField({
  label,
  error,
  hint,
  labelAction,
  containerClassName,
  id,
  className,
  ...inputProps
}: PasswordFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [visible, setVisible] = useState(false)

  return (
    <FormField id={inputId} label={label} error={error} hint={hint} labelAction={labelAction} className={containerClassName}>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, { error, hint })}
          className={controlClasses(Boolean(error), `pr-12 ${className ?? ''}`)}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </FormField>
  )
}
