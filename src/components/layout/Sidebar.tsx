import { Link, NavLink } from 'react-router'
import { LogOut, Plus } from 'lucide-react'
import { desktopNav } from '@/components/layout/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { useCurrentUser } from '@/hooks/useAuth'
import { useSignOut } from '@/hooks/useSignOut'
import { cn } from '@/lib/cn'
import { paths } from '@/routes/paths'

export function Sidebar() {
  const { user, profile, displayName } = useCurrentUser()
  const { signOut, signingOut } = useSignOut()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link to={paths.dashboard} aria-label="TripSplit dashboard" className="rounded-lg">
          <Logo />
        </Link>
      </div>

      <div className="px-4 pt-2">
        <ButtonLink to={paths.addExpense} fullWidth icon={<Plus className="size-5" aria-hidden />}>
          Add expense
        </ButtonLink>
      </div>

      <nav aria-label="Main" className="mt-6 flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {desktopNav.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <Link
            to={paths.profile}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50"
          >
            <Avatar name={displayName} src={profile?.avatar_url} size="md" decorative />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{displayName}</span>
              <span className="block truncate text-xs text-slate-500">{user.email}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  )
}
