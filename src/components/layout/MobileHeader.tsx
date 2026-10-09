import { Link, NavLink } from 'react-router'
import { Bell, Settings } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/cn'
import { paths } from '@/routes/paths'

const iconLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex size-11 items-center justify-center rounded-full transition-colors',
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  )

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to={paths.dashboard} aria-label="TripSplit home" className="rounded-lg">
          <Logo />
        </Link>
        <div className="-mr-2 flex items-center">
          <NavLink to={paths.notifications} className={iconLink} aria-label="Notifications">
            <Bell className="size-5" aria-hidden />
          </NavLink>
          <NavLink to={paths.settings} className={iconLink} aria-label="Settings">
            <Settings className="size-5" aria-hidden />
          </NavLink>
        </div>
      </div>
    </header>
  )
}
