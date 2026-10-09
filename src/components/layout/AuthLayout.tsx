import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { PageLoader } from '@/components/ui/Spinner'
import { paths } from '@/routes/paths'
import { formatMoney } from '@/utils/calculations/money'

/** A tiny, decorative preview of what TripSplit does. */
function ExpensePreview() {
  const travelers = [
    { initials: 'MR', className: 'bg-blue-100 text-blue-700' },
    { initials: 'JC', className: 'bg-emerald-100 text-emerald-700' },
    { initials: 'SL', className: 'bg-violet-100 text-violet-700' },
    { initials: 'AT', className: 'bg-amber-100 text-amber-800' },
  ]
  return (
    <div aria-hidden className="mt-10 max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-2xl shadow-blue-950/25">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-orange-50 text-xl">🍜</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">Dinner at Lau Pa Sat</p>
          <p className="text-sm text-slate-500">Paid by Michael · Split 4 ways</p>
        </div>
        <p className="font-bold">{formatMoney(250000, 'PHP')}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex -space-x-1.5">
          {travelers.map((traveler) => (
            <span
              key={traveler.initials}
              className={`flex size-9 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white ${traveler.className}`}
            >
              {traveler.initials}
            </span>
          ))}
        </div>
        <p className="text-sm font-semibold text-emerald-600">{formatMoney(62500, 'PHP')} each</p>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold text-slate-500">
          <span>Trip budget</span>
          <span>64.9% spent</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[64.9%] rounded-full bg-blue-600" />
        </div>
      </div>
    </div>
  )
}

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="relative hidden w-[44%] max-w-2xl flex-col justify-between overflow-hidden bg-linear-to-br from-blue-700 via-blue-600 to-sky-500 p-10 text-white lg:flex xl:p-14">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-sky-300/20" />

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
          <p className="mt-5 max-w-sm text-lg text-blue-100">
            Your group&apos;s travel budget, simplified. Log an expense in seconds — TripSplit works out who owes whom.
          </p>
          <ExpensePreview />
        </div>

        <p className="relative text-sm text-blue-100/80">© {new Date().getFullYear()} TripSplit</p>
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
          </div>
        </div>
      </main>
    </div>
  )
}
