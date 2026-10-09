import { cn } from '@/lib/cn'

interface CategoryIconProps {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'size-8 text-base rounded-lg', md: 'size-10 text-xl rounded-xl', lg: 'size-14 text-3xl rounded-2xl' }

/** The category emoji on a soft tint of its colour. */
export function CategoryIcon({ icon, color, size = 'md', className }: CategoryIconProps) {
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center', sizes[size], className)}
      style={{ backgroundColor: `${color}1f` }}
    >
      {icon}
    </span>
  )
}
