import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'
import { LegalLinks } from '@/components/layout/SiteFooter'
import { ExpensePreview } from '@/components/marketing/ProductPreview'
import { Logo } from '@/components/ui/Logo'
import { PageLoader } from '@/components/ui/Spinner'
import { paths } from '@/routes/paths'

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="relative hidden w-[44%] max-w-2xl flex-col justify-between overflow-hidden bg-linear-to-br from-brand-800 via-brand-700 to-brand-600 p-10 text-white lg:flex xl:p-14">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-sunset-400" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-white/10" />

        <Link to={paths.home} className="relative w-fit rounded-lg" aria-label="TripSplit home">
          <Logo inverted />
        </Link>

        <div className="relative">
          <h2 className="text-4xl leading-[1.1] font-extrabold tracking-tight xl:text-5xl">
            Travel together.
            <br />
            Track together.
            <br />
            Split smarter.
          </h2>
          <p className="mt-5 max-w-sm text-lg text-white/90">
            Your group&apos;s travel budget, simplified. Log an expense in seconds — TripSplit works out who owes whom.
          </p>
          <ExpensePreview className="mt-10 max-w-sm" />
        </div>

        <p className="relative text-sm text-white/75">© {new Date().getFullYear()} TripSplit</p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:hidden">
          <Link to={paths.home} className="inline-block rounded-lg" aria-label="TripSplit home">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-5 py-10 sm:items-center sm:px-8">
          <div className="animate-rise-in w-full max-w-sm">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
            <LegalLinks className="mt-10 justify-center" />
          </div>
        </div>
      </main>
    </div>
  )
}
