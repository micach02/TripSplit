import { Activity, Bell, CirclePlus, CircleUser, House, LayoutDashboard, Luggage, Settings, type LucideIcon } from 'lucide-react'
import { paths } from '@/routes/paths'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Only active on an exact path match (so /trips isn't active on /trips/new). */
  end?: boolean
}

export const desktopNav: NavItem[] = [
  { to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: paths.trips, label: 'My Trips', icon: Luggage, end: true },
  { to: paths.newTrip, label: 'Create Trip', icon: CirclePlus },
  { to: paths.notifications, label: 'Notifications', icon: Bell },
  { to: paths.profile, label: 'Profile', icon: CircleUser },
  { to: paths.settings, label: 'Settings', icon: Settings },
]

/** Bottom tab bar; "Add Expense" sits in the middle as a raised button. */
export const mobileNavLeft: NavItem[] = [
  { to: paths.dashboard, label: 'Home', icon: House },
  { to: paths.trips, label: 'Trips', icon: Luggage },
]

export const mobileNavRight: NavItem[] = [
  { to: paths.activity, label: 'Activity', icon: Activity },
  { to: paths.profile, label: 'Profile', icon: CircleUser },
]
