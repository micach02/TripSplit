import { WifiOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOutbox } from '@/hooks/useOutbox'

/** A thin bar while the connection is down, so nobody is surprised about saving. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const { user } = useAuth()
  const waiting = useOutbox(user?.id).length
  if (online) return null

  return (
    <div
      role="status"
      className="animate-fade-in fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-slate-900 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-center text-sm font-semibold text-slate-50"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      {user
        ? `You’re offline. New expenses are saved on this phone${waiting ? ` (${waiting} waiting)` : ''} and sync later.`
        : 'You’re offline. Reconnect to log in.'}
    </div>
  )
}
