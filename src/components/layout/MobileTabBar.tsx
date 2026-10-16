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
            'flex h-15 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors',
            isActive ? 'text-primary-600' : 'text-slate-500 active:text-slate-800',
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-center rounded-full bg-surface/95 px-1 shadow-float ring-1 ring-slate-900/[0.06] backdrop-blur-md">
        {mobileNavLeft.map((item) => (
          <TabLink key={item.to} {...item} />
        ))}
        <li className="flex justify-center">
          <NavLink
            to={paths.addExpense}
            aria-label="Add expense"
            className="-mt-8 flex size-16 items-center justify-center rounded-full bg-sunset-600 text-white shadow-lg shadow-sunset-500/40 ring-[5px] ring-surface transition-transform active:scale-95"
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
