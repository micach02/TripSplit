import { NavLink } from 'react-router'
import { cn } from '@/lib/cn'
import { tripPath, type TripSection } from '@/routes/paths'

const tabs: Array<{ section?: TripSection; label: string; settleUp?: boolean }> = [
  { label: 'Overview' },
  { section: 'expenses', label: 'Expenses' },
  { section: 'people', label: 'People' },
  { section: 'balances', label: 'Balances', settleUp: true },
  { section: 'analytics', label: 'Analytics' },
]

interface TripTabsProps {
  tripId: string
  label: string
  /** Balances (with the payments recorded) only matter with two or more people. */
  showSettleUp: boolean
  /** Query string to keep across tabs, e.g. "?month=2026-09" */
  search?: string
}

/**
 * Five tabs at most, so they fit a phone; Settings is the gear in the trip
 * header, and payments live on Balances. Still scrolls on the narrowest screens.
 */
export function TripTabs({ tripId, label, showSettleUp, search = '' }: TripTabsProps) {
  return (
    <nav aria-label={label} className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 max-sm:min-w-full max-sm:gap-0.5">
        {tabs
          .filter((tab) => showSettleUp || !tab.settleUp)
          .map(({ section, label: tabLabel }) => (
            <li key={tabLabel} className="max-sm:flex-1">
              <NavLink
                to={`${tripPath(tripId, section)}${search}`}
                end={!section}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors max-sm:px-1 max-[380px]:text-[13px]',
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                  )
                }
              >
                {tabLabel}
              </NavLink>
            </li>
          ))}
      </ul>
    </nav>
  )
}
