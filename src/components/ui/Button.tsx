import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { buttonClasses, type ButtonStyleOptions } from '@/components/ui/buttonStyles'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  icon,
  type = 'button',
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps, ButtonStyleOptions {
  icon?: ReactNode
}

/** A router link styled as a button. */
export function ButtonLink({ variant, size, fullWidth, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses({ variant, size, fullWidth }), className)} {...props}>
      {icon}
      {children}
    </Link>
  )
}
