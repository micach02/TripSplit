import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { CurrencySelect } from '@/components/forms/CurrencySelect'
import { TextField } from '@/components/forms/TextField'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import { PageTitle } from '@/components/ui/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { DEFAULT_CURRENCY } from '@/lib/currencies'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'

const newBudget = (name: string) => `${paths.newTrip}?kind=budget&name=${encodeURIComponent(name)}`

const CHOICES = [
  { emoji: '🛒', title: 'Groceries & food', text: 'Market runs, eating out and deliveries, month by month.', to: newBudget('Groceries & food') },
  { emoji: '🏠', title: 'Household bills', text: 'Rent, electricity, water and internet — on your own or with housemates.', to: newBudget('Household bills') },
  { emoji: '💳', title: 'All my spending', text: 'One monthly budget for everything you spend.', to: newBudget('Everyday spending') },
  { emoji: '✈️', title: 'A trip with friends', text: 'Dates, a destination and one budget to split.', to: paths.newTrip },
]

function Progress({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5" aria-hidden>
        {[1, 2].map((n) => (
          <span key={n} className={cn('h-2 flex-1 rounded-full', n <= step ? 'bg-sunset-400' : 'bg-slate-200')} />
        ))}
      </div>
      <p className="text-xs font-semibold text-slate-500">Step {step} of 2</p>
    </div>
  )
}

/**
 * Shown once to new accounts (see ProtectedRoute): confirm the basics, then
 * start with a budget or trip. Finishing or skipping sets profiles.onboarded_at.
 */
export default function WelcomePage() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(profile?.full_name ?? '')
  const [currency, setCurrency] = useState(profile?.preferred_currency ?? DEFAULT_CURRENCY)
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function saveBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setNameError('Enter your name — it’s how people you share with will see you.')
    setNameError(null)
    setError(null)
    setBusy(true)
    try {
      await updateProfile({ full_name: trimmed, preferred_currency: currency })
      setStep(2)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function finish(to: string) {
    setBusy(true)
    try {
      await updateProfile({ onboarded_at: new Date().toISOString() })
    } catch {
      // Not worth blocking on: at worst they see this screen once more.
    }
    navigate(to, { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 sm:justify-center sm:py-12">
      <PageTitle title="Welcome" />
      <div className="flex items-center justify-between gap-4">
        <Logo />
        <button
          type="button"
          onClick={() => finish(paths.dashboard)}
          disabled={busy}
          className="tap-target rounded text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          Skip
        </button>
      </div>

      <Card className="animate-rise-in mt-8 p-5 sm:p-8">
        <Progress step={step} />

        {step === 1 ? (
          <form onSubmit={saveBasics} noValidate className="mt-6 space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Welcome to TripSplit 👋</h1>
              <p className="mt-1.5 text-slate-600">Two quick things, and you’re ready to log your first expense.</p>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <TextField
              label="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={nameError}
              hint="People you share budgets and trips with see this."
              autoComplete="name"
              autoCapitalize="words"
              maxLength={100}
            />
            <CurrencySelect
              label="Your currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              hint="New budgets and your totals use it. Each budget or trip can still have its own."
            />
            <Button type="submit" size="lg" fullWidth loading={busy} icon={<ArrowRight className="size-5" aria-hidden />}>
              Continue
            </Button>
          </form>
        ) : (
          <div className="mt-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">What do you want to track first?</h1>
            <p className="mt-1.5 text-slate-600">Pick one to start — you can add as many budgets and trips as you like.</p>
            <ul className="mt-6 space-y-3">
              {CHOICES.map((choice) => (
                <li key={choice.title}>
                  <button
                    type="button"
                    onClick={() => finish(choice.to)}
                    disabled={busy}
                    className="flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left ring-1 ring-slate-200 transition hover:bg-coral-50/50 hover:ring-coral-300 disabled:opacity-60"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-coral-50 text-2xl" aria-hidden>
                      {choice.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">{choice.title}</span>
                      <span className="mt-0.5 block text-sm text-slate-500">{choice.text}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={busy}
                className="tap-target rounded text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => finish(paths.dashboard)}
                disabled={busy}
                className="tap-target rounded text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                I’ll look around first
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
