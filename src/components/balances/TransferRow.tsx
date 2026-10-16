import { ArrowRight, HandCoins } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { memberName, type TripContextValue } from '@/hooks/useTripContext'
import { cn } from '@/lib/cn'
import type { Transfer } from '@/utils/calculations/debtSimplifier'

interface TransferRowProps {
  transfer: Transfer
  context: Pick<TripContextValue, 'memberById' | 'currentUserId' | 'money'>
  onRecord: (transfer: Transfer) => void
}

/** "John → Michael  ₱3,000  [Record]" */
export function TransferRow({ transfer, context, onRecord }: TransferRowProps) {
  const from = context.memberById.get(transfer.from)
  const to = context.memberById.get(transfer.to)
  const involvesMe = transfer.from === context.currentUserId || transfer.to === context.currentUserId

  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5', involvesMe && 'bg-primary-50/50')}>
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
        <Avatar name={from?.profile.full_name} src={from?.profile.avatar_url} size="sm" decorative />
        <ArrowRight className="size-4 shrink-0 text-slate-400" aria-hidden />
        <Avatar name={to?.profile.full_name} src={to?.profile.avatar_url} size="sm" decorative />
        <p className="min-w-0 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{memberName(context, transfer.from, { you: true })}</span>
          {transfer.from === context.currentUserId ? ' pay ' : ' pays '}
          <span className="font-semibold text-slate-900">{memberName(context, transfer.to, { you: true })}</span>
        </p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <p className="text-base font-extrabold text-slate-900 tabular-nums">{context.money.format(transfer.amount)}</p>
        <Button size="sm" variant="secondary" onClick={() => onRecord(transfer)} icon={<HandCoins className="size-4" aria-hidden />}>
          Record
        </Button>
      </div>
    </li>
  )
}
