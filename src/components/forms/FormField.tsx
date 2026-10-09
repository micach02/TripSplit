import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { fieldIds } from '@/components/forms/controlStyles'

interface FormFieldProps {
  id: string
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  /** Shown at the end of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + control + hint/error, with the ids the control's aria-describedby points at. */
export function FormField({ id, label, error, hint, labelAction, className, children }: FormFieldProps) {
  const { hintId, errorId } = fieldIds(id)
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">
          {label}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-red-600">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1.5 text-sm text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
