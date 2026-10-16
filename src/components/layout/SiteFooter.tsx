import { Link } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/cn'
import { paths } from '@/routes/paths'

const linkClass = 'tap-target rounded font-semibold text-slate-600 hover:text-slate-900'

/** The small print under public pages and the sign-in forms: Privacy · Terms. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500', className)}>
      <Link to={paths.privacy} className={linkClass}>
        Privacy
      </Link>
      <Link to={paths.terms} className={linkClass}>
        Terms
      </Link>
      <span>© {new Date().getFullYear()} TripSplit</span>
    </p>
  )
}

/** Footer for the landing and legal pages. */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Link to={paths.home} className="inline-block rounded-lg" aria-label="TripSplit home">
            <Logo />
          </Link>
          <p className="mt-2 max-w-xs text-sm text-slate-500">
            Budgets, trips and shared expenses — for households, barkadas and travel buddies.
          </p>
        </div>
        <LegalLinks />
      </div>
    </footer>
  )
}
