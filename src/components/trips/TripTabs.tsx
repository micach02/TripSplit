import { NavLink } from 'react-router'
import { cn } from '@/lib/cn'
import { tripPath, type TripSection } from '@/routes/paths'

const tabs: Array<{ section?: TripSection; label: string }> = [
  { label: 'Overview' },
  { section: 'expenses', label: 'Expenses' },
  { section: 'people', label: 'People' },
  { section: 'balances', label: 'Balances' },
  { section: 'settlements', label: 'Settlements' },
  { section: 'analytics', label: 'Analytics' },
  { section: 'settings', label: 'Settings' },
]

/** Horizontally scrollable on phones. */
export function TripTabs({ tripId }: { tripId: string }) {
  return (
    <nav aria-label="Trip sections" className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-slate-200">
        {tabs.map(({ section, label }) => (
          <li key={label}>
            <NavLink
              to={tripPath(tripId, section)}
              end={!section}
              className={({ isActive }) =>
                cn(
                  '-mb-px flex h-11 items-center border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                )
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
