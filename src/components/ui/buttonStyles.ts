import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors select-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800',
  secondary: 'bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200',
  outline: 'bg-white text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-600',
}

// Every size keeps a ≥44px touch target on touch screens.
const sizes: Record<ButtonSize, string> = {
  sm: 'h-11 px-3.5 text-sm sm:h-9',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

/**
 * Buttons are always `inline-flex`, which beats a plain `hidden` passed in
 * className. To hide a button on phones use `max-sm:hidden` (a variant wins).
 */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false }: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full')
}
