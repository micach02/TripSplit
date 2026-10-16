import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/cn'
import { getInstallState, subscribeInstall } from '@/lib/installPrompt'
import { paths, tripPath } from '@/routes/paths'
import type { DashboardSummary } from '@/services/dashboardService'

const storageKey = (userId: string) => `tripsplit:getting-started-hidden:${userId}`

function readHidden(userId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1'
  } catch {
    return false
  }
}

/**
 * A short checklist for new accounts on the dashboard. It goes away once
 * everything is done, or when hidden (remembered on this device).
 */
export function GettingStarted({ summary, userId }: { summary: DashboardSummary; userId: string }) {
  const installState = useSyncExternalStore(subscribeInstall, getInstallState)
  const [hidden, setHidden] = useState(() => readHidden(userId))
  const firstTrip = summary.activeTrips[0]

  const steps = [
    {
      done: summary.tripCount > 0,
      title: 'Create a budget or trip',
      text: 'Monthly groceries, household bills, or a trip with friends.',
      to: paths.newTrip,
      action: 'Create',
    },
    {
      // Older offline copies of the summary don't have these counts.
      done: (summary.expenseCount ?? 0) > 0,
      title: 'Log your first expense',
      text: 'Tap + whenever you spend. It takes a few seconds.',
      to: paths.addExpense,
      action: 'Add expense',
    },
    {
      done: summary.sharesWithOthers ?? false,
      title: 'Add the people you share costs with',
      text: 'Optional — a name is enough, no account needed.',
      to: firstTrip ? tripPath(firstTrip.id, 'people') : paths.trips,
      action: 'Add people',
    },
    {
      done: installState === 'installed',
      title: 'Put TripSplit on your home screen',
      text: 'It opens like an app and works offline.',
      to: `${paths.settings}#install`,
      action: 'Show me',
    },
  ]
  const doneCount = steps.filter((step) => step.done).length
  if (hidden || doneCount === steps.length) return null

  function hide() {
    setHidden(true)
    try {
      window.localStorage.setItem(storageKey(userId), '1')
    } catch {
      // Private mode: it stays hidden until the page reloads.
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Getting started"
        description={`${doneCount} of ${steps.length} done`}
        action={
          <Button variant="ghost" size="sm" onClick={hide}>
            Hide
          </Button>
        }
      />
      <div className="px-5 pt-3 sm:px-6">
        <ProgressBar value={(doneCount / steps.length) * 100} tone="positive" label="Getting started progress" />
      </div>
      <ol className="mt-3 divide-y divide-slate-100">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-3 px-5 py-3 sm:px-6">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
              )}
            >
              {step.done ? <Check className="size-4" strokeWidth={3} aria-label="Done" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('font-semibold', step.done ? 'text-slate-500 line-through' : 'text-slate-900')}>{step.title}</p>
              {!step.done && <p className="text-sm text-slate-500">{step.text}</p>}
            </div>
            {!step.done && (
              <Link to={step.to} className="tap-target shrink-0 rounded text-sm font-semibold text-primary-600 hover:text-primary-700">
                {step.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}
