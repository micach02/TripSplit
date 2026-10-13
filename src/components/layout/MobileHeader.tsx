import { Link, NavLink } from 'react-router'
import { Bell, Settings } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useInvitations } from '@/hooks/useInvitations'
import { cn } from '@/lib/cn'
import { paths } from '@/routes/paths'

const iconLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex size-11 items-center justify-center rounded-full transition-colors',
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  )

export function MobileHeader() {
  const { count } = useInvitations()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to={paths.dashboard} aria-label="TripSplit home" className="rounded-lg">
          <Logo />
        </Link>
        <div className="-mr-2 flex items-center">
          <NavLink
            to={paths.notifications}
            className={iconLink}
            aria-label={count > 0 ? `Notifications, ${count} new` : 'Notifications'}
          >
            <Bell className="size-5" aria-hidden />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-surface"
              >
                {count > 9 ? '9+' : count}
              </span>
            )}
          </NavLink>
          <NavLink to={paths.settings} className={iconLink} aria-label="Settings">
            <Settings className="size-5" aria-hidden />
          </NavLink>
        </div>
      </div>
    </header>
  )
}
