import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PartyPopper, Scale } from 'lucide-react'
import { SettlementDialog, type SettlementPrefill } from '@/components/balances/SettlementDialog'
import { TransferRow } from '@/components/balances/TransferRow'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { memberName, useTripContext } from '@/hooks/useTripContext'
import { useTripLedger } from '@/hooks/useTripLedger'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { tripPath } from '@/routes/paths'
import { calculateBalances, describeBalance } from '@/utils/calculations/balanceCalculator'
import { simplifyDebts } from '@/utils/calculations/debtSimplifier'

export default function TripBalancesPage() {
  const context = useTripContext()
  const { trip, members, currentUserId, money } = context
  const toast = useToast()
  const ledger = useTripLedger(trip)
  const [prefill, setPrefill] = useState<SettlementPrefill | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { balances, transfers } = useMemo(() => {
    if (!ledger.data) return { balances: [], transfers: [] }
    const computed = calculateBalances(
      members.map((member) => member.userId),
      ledger.data.expenses,
      ledger.data.settlements.map((s) => ({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount })),
    )
    // Roster order, so people don't jump around as balances change
    const order = new Map(members.map((member, index) => [member.userId, index]))
    computed.sort((a, b) => (order.get(a.userId) ?? 99) - (order.get(b.userId) ?? 99))
    return { balances: computed, transfers: simplifyDebts(computed) }
  }, [ledger.data, members])

  if (ledger.error && !ledger.data) {
    return (
      <Alert tone="error" title="We couldn't load balances">
        <p>{getErrorMessage(ledger.error)}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={ledger.reload}>
          Try again
        </Button>
      </Alert>
    )
  }
  if (!ledger.data) return <PageLoader label="Calculating balances…" />

  if (ledger.data.expenses.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Scale}
          title="Nothing to balance yet"
          description="Once expenses are added, you'll see who owes whom here."
        />
      </Card>
    )
  }

  const mine = balances.find((balance) => balance.userId === currentUserId)
  const myState = mine ? describeBalance(mine.net) : 'settled'

  function openDialog(next: SettlementPrefill | null) {
    setPrefill(next)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {mine && (
        <Card
          className="p-5 sm:p-6"
          tone={myState === 'receives' ? 'positive' : myState === 'owes' ? 'negative' : 'default'}
        >
          <p className="text-sm font-semibold text-slate-600">Your balance</p>
          <p
            className={cn(
              'mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl',
              myState === 'receives' ? 'text-emerald-700' : myState === 'owes' ? 'text-red-700' : 'text-slate-900',
            )}
          >
            {myState === 'receives'
              ? `You should receive ${money.format(mine.net)}`
              : myState === 'owes'
                ? `You owe ${money.format(-mine.net)}`
                : 'You’re all settled up'}
          </p>
          <p className="mt-2 text-sm text-slate-600 tabular-nums">
            You paid {money.format(mine.paid)} · your share is {money.format(mine.share)}
            {mine.settlementsPaid > 0 && ` · you paid back ${money.format(mine.settlementsPaid)}`}
            {mine.settlementsReceived > 0 && ` · you were paid ${money.format(mine.settlementsReceived)}`}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title="Suggested payments"
          description={
            transfers.length > 0
              ? `${transfers.length === 1 ? 'One payment settles' : `${transfers.length} payments settle`} everything — the fewest possible.`
              : undefined
          }
          action={
            <Button variant="outline" size="sm" onClick={() => openDialog(null)}>
              Record other payment
            </Button>
          }
        />
        <div className="mt-4 border-t border-slate-100">
          {transfers.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 sm:px-6">
              <PartyPopper className="size-6 text-emerald-600" aria-hidden />
              <p className="font-semibold text-slate-800">Everyone is settled up 🎉</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transfers.map((transfer) => (
                <TransferRow
                  key={`${transfer.from}-${transfer.to}`}
                  transfer={transfer}
                  context={context}
                  onRecord={(t) => openDialog({ fromUserId: t.from, toUserId: t.to, amount: t.amount })}
                />
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Everyone's balance"
          description="Paid minus their share, adjusted for payments made between travelers."
        />
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {balances.map((balance) => {
            const member = context.memberById.get(balance.userId)
            const state = describeBalance(balance.net)
            const name = memberName(context, balance.userId)
            return (
              <li key={balance.userId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar name={member?.profile.full_name} src={member?.profile.avatar_url} size="md" decorative />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {name}
                    {balance.userId === currentUserId && <span className="ml-1 font-normal text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500 tabular-nums">
                    Paid {money.format(balance.paid)} · Share {money.format(balance.share)}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      'font-extrabold tabular-nums',
                      state === 'receives' ? 'text-emerald-600' : state === 'owes' ? 'text-red-600' : 'text-slate-400',
                    )}
                  >
                    {state === 'settled' ? money.format(0) : money.format(balance.net, { signDisplay: 'always' })}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {state === 'receives' ? 'should receive' : state === 'owes' ? 'owes' : 'settled up'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
        <CardBody className="pt-3 text-xs text-slate-500">
          See every payment on the{' '}
          <Link to={tripPath(trip.id, 'settlements')} className="font-semibold text-blue-600 hover:text-blue-700">
            Settlements
          </Link>{' '}
          tab.
        </CardBody>
      </Card>

      <SettlementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false)
          toast.success('Payment recorded. Balances updated.')
          ledger.reload()
        }}
        context={context}
        prefill={prefill}
      />
    </div>
  )
}
