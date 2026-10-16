import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

// Pill-shaped and a little bouncy. Fills that carry text use the fixed brand
// and sunset colours, so they look the same in dark mode.
const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition select-none active:scale-[0.98] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-800',
  // The one warm call to action on a screen, e.g. "Add expense"
  accent: 'bg-sunset-400 text-sunset-950 shadow-md shadow-sunset-500/30 hover:bg-sunset-300',
  secondary: 'bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200',
  outline: 'bg-surface text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  danger:
    'bg-danger-600 text-white shadow-md shadow-red-600/20 hover:bg-danger-700 active:bg-danger-800 focus-visible:outline-red-600',
}

// Every size keeps a ≥44px touch target on touch screens.
const sizes: Record<ButtonSize, string> = {
  sm: 'h-11 px-4 text-sm sm:h-9',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

/**
 * Buttons are always `inline-flex`, which beats a plain `hidden` passed in
 * className. To hide a button on phones use `max-sm:hidden` (a variant wins).
 */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false }: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full')
}
