import { Bell, ChartPie, CirclePlus, CircleUser, House, LayoutDashboard, Search, Settings, Wallet, type LucideIcon } from 'lucide-react'
import { paths } from '@/routes/paths'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Only active on an exact path match (so /trips isn't active on /trips/new). */
  end?: boolean
  /** Keyboard shortcut shown next to the label */
  shortcut?: string
}

export const desktopNav: NavItem[] = [
  { to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: paths.search, label: 'Search', icon: Search, shortcut: '/' },
  { to: paths.spending, label: 'My spending', icon: ChartPie },
  { to: paths.trips, label: 'Budgets & Trips', icon: Wallet, end: true },
  { to: paths.newTrip, label: 'Create', icon: CirclePlus },
  { to: paths.notifications, label: 'Notifications', icon: Bell },
  { to: paths.profile, label: 'Profile', icon: CircleUser },
  { to: paths.settings, label: 'Settings', icon: Settings },
]

/** Bottom tab bar; "Add Expense" sits in the middle as a raised button. */
export const mobileNavLeft: NavItem[] = [
  { to: paths.dashboard, label: 'Home', icon: House },
  { to: paths.trips, label: 'Budgets', icon: Wallet },
]

export const mobileNavRight: NavItem[] = [
  { to: paths.spending, label: 'Spending', icon: ChartPie },
  { to: paths.profile, label: 'Profile', icon: CircleUser },
]
