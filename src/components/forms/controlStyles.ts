import { cn } from '@/lib/cn'

/**
 * Shared look for inputs and selects. text-base (16px) on phones stops iOS
 * Safari from zooming in when a field is focused.
 */
export function controlClasses(invalid: boolean, className?: string): string {
  return cn(
    'block h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-slate-900 shadow-xs transition-colors sm:h-11 sm:text-[15px]',
    'placeholder:text-slate-500 focus:ring-4 focus:outline-none',
    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
      : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500/15',
    className,
  )
}

/** ids for a field's hint and error, wired to aria-describedby. */
export function fieldIds(id: string) {
  return { hintId: `${id}-hint`, errorId: `${id}-error` }
}

export function describedBy(id: string, { error, hint }: { error?: string | null; hint?: unknown }): string | undefined {
  const { hintId, errorId } = fieldIds(id)
  if (error) return errorId
  if (hint) return hintId
  return undefined
}

/** Moves focus to the first invalid control after a failed submit. */
export function focusFirstInvalid(form: HTMLFormElement): void {
  requestAnimationFrame(() => {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}
