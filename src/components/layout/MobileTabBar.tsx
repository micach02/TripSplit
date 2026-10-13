import { NavLink } from 'react-router'
import { Plus } from 'lucide-react'
import { mobileNavLeft, mobileNavRight, type NavItem } from '@/components/layout/navigation'
import { cn } from '@/lib/cn'
import { paths } from '@/routes/paths'

function TabLink({ to, label, icon: Icon, end }: NavItem) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
            isActive ? 'text-blue-600' : 'text-slate-500 active:text-slate-800',
          )
        }
      >
        <Icon className="size-6" aria-hidden />
        {label}
      </NavLink>
    </li>
  )
}

export function MobileTabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-center">
        {mobileNavLeft.map((item) => (
          <TabLink key={item.to} {...item} />
        ))}
        <li className="flex justify-center">
          <NavLink
            to={paths.addExpense}
            aria-label="Add expense"
            className="-mt-7 flex size-15 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-blue-600/35 ring-4 ring-surface transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </NavLink>
        </li>
        {mobileNavRight.map((item) => (
          <TabLink key={item.to} {...item} />
        ))}
      </ul>
    </nav>
  )
}
