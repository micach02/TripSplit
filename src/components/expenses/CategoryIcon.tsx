import { cn } from '@/lib/cn'

interface CategoryIconProps {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'size-8 text-base', md: 'size-11 text-[1.375rem]', lg: 'size-14 text-3xl' }

/** The category emoji on a soft tint of its colour. */
export function CategoryIcon({ icon, color, size = 'md', className }: CategoryIconProps) {
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full', sizes[size], className)}
      style={{ backgroundColor: `${color}26` }}
    >
      {icon}
    </span>
  )
}
