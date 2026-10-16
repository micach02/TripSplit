import { Link } from 'react-router'
import {
  ChartPie,
  ChevronDown,
  Divide,
  HandCoins,
  ScanText,
  Smartphone,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { ExpensePreview, SettlePreview } from '@/components/marketing/ProductPreview'
import { ButtonLink } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageHeader'
import { paths } from '@/routes/paths'

const TILE_COLORS = [
  'bg-coral-50 text-coral-700',
  'bg-primary-50 text-primary-700',
  'bg-amber-50 text-amber-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-sky-50 text-sky-700',
]

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Wallet,
    title: 'Monthly budgets',
    text: 'Groceries, food, bills — alone or with your household. Each month starts fresh, or rolls over what’s left.',
  },
  {
    icon: UsersRound,
    title: 'Trips with friends',
    text: 'Add your barkada by name. Nobody needs an account to be in the split — invite them later if they want to see it.',
  },
  {
    icon: Divide,
    title: 'Fair splits',
    text: 'Split equally, by shares, by percentage or by exact amounts. Every centavo adds up to the total.',
  },
  {
    icon: HandCoins,
    title: 'Settle up in a few taps',
    text: 'See who owes whom, and the fewest payments that settle everything. Record them as cash, GCash, Maya or card.',
  },
  {
    icon: ChartPie,
    title: 'Know where it goes',
    text: 'Your share of everything by category and by day, compared with last month and with what you earn.',
  },
  {
    icon: Smartphone,
    title: 'Made for your phone',
    text: 'Install it like an app. Log an expense in seconds — even without signal; it syncs when you’re back online.',
  },
]

const STEPS = [
  { title: 'Create a budget or a trip', text: 'Pick a monthly budget or a trip with dates, and set how much you want to spend.' },
  { title: 'Add people and expenses', text: 'Type in who’s sharing, then log what you spend as you go — or snap a receipt.' },
  { title: 'Settle up', text: 'TripSplit works out the balances. One tap records each payment back.' },
]

const FAQ = [
  {
    q: 'Is TripSplit free?',
    a: 'Yes. There are no ads and nothing to pay. TripSplit only keeps track — it never moves money.',
  },
  {
    q: 'Do my friends need an account?',
    a: 'No. Add them by name and split expenses with them right away. If someone wants to see the trip and add expenses themselves, send them an invite link; when they join, everything recorded for them becomes theirs.',
  },
  {
    q: 'Which currencies can I use?',
    a: 'Each budget or trip has its own currency, and you can log expenses in other currencies too — the exchange rate is filled in for you from European Central Bank reference rates.',
  },
  {
    q: 'Who can see my spending?',
    a: 'Only the people on each budget or trip see its expenses. Your income and your “My spending” overview are visible to you alone.',
  },
  {
    q: 'Does it work offline?',
    a: 'Once installed, TripSplit opens without a connection. Expenses you add offline are saved on your phone and sent as soon as you’re back online.',
  },
  {
    q: 'Can I get my data out?',
    a: 'Yes. Every budget and trip, and your own spending overview, can be downloaded as a CSV file for Excel or Google Sheets.',
  },
]

function SignUpButtons({ center = false }: { center?: boolean }) {
  return (
    <div className={center ? 'flex flex-wrap justify-center gap-3' : 'flex flex-wrap gap-3'}>
      <ButtonLink to={paths.register} size="lg">
        Create a free account
      </ButtonLink>
      <ButtonLink to={paths.login} size="lg" variant="outline">
        Log in
      </ButtonLink>
    </div>
  )
}

/** The front door for visitors who aren't signed in. */
export default function LandingPage() {
  return (
    <>
      <PageTitle title="Budgets, trips and shared expenses" />

      {/* Hero */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24">
          <div>
            <p className="inline-flex rounded-full bg-coral-50 px-3 py-1 text-sm font-bold text-coral-800 ring-1 ring-coral-100">
              ✈️ Budgets · Trips · Splits
            </p>
            <h1 className="mt-4 text-4xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Know where your money goes — and who owes whom.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              TripSplit keeps your monthly budgets and group trips in one place. Log an expense in seconds, split it
              fairly, and settle up with the fewest payments.
            </p>
            <div className="mt-8">
              <SignUpButtons />
            </div>
            <p className="mt-4 text-sm text-slate-500">Free · No ads · Works on any phone or computer</p>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            {/* Sea and sun: the same motif as the dashboard and sign-in panels */}
            <div
              aria-hidden
              className="absolute -inset-6 -z-0 overflow-hidden rounded-[2.5rem] bg-linear-to-br from-brand-800 via-brand-700 to-primary-500 sm:-inset-8"
            >
              <div className="absolute -top-14 -right-14 size-44 rounded-full bg-sunset-400" />
            </div>
            <ExpensePreview className="relative" />
            <SettlePreview className="relative mt-4 ml-auto w-64 sm:-mr-6" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="border-t border-slate-200/70 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="features-heading" className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900">
            Everything for shared and everyday spending
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            From the weekly grocery run to a week in Siargao — one app, no spreadsheets.
          </p>
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="rounded-3xl bg-canvas p-5 ring-1 ring-slate-200/70">
                <span className={`flex size-11 items-center justify-center rounded-full ${TILE_COLORS[index % TILE_COLORS.length]}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
            <ScanText className="size-4 text-slate-500" aria-hidden />
            Also: receipt scanning, recurring bills, many currencies, CSV export and dark mode.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="how-heading" className="text-3xl font-extrabold tracking-tight text-slate-900">
            How it works
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 md:flex-col">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunset-400 font-extrabold text-sunset-950">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="border-t border-slate-200/70 bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="faq-heading" className="text-3xl font-extrabold tracking-tight text-slate-900">
            Questions
          </h2>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-5 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl bg-linear-to-br from-brand-800 via-brand-700 to-brand-600 relative overflow-hidden px-6 py-12 text-center text-white sm:px-12">
            <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-sunset-400" />
            <h2 id="cta-heading" className="relative text-3xl font-extrabold tracking-tight">
              Start in under a minute
            </h2>
            <p className="relative mx-auto mt-3 max-w-lg text-white/90">
              Create a free account, set up your first budget or trip, and log your first expense.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to={paths.register}
                className="inline-flex h-12 items-center rounded-full bg-sunset-400 px-6 font-bold text-sunset-950 shadow-md transition-colors hover:bg-sunset-300"
              >
                Create a free account
              </Link>
              <Link
                to={paths.login}
                className="inline-flex h-12 items-center rounded-full px-6 font-bold text-white ring-1 ring-white/60 transition-colors ring-inset hover:bg-white/10"
              >
                I have an account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
