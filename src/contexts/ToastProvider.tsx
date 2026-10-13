import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { ToastContext, type ToastContextValue, type ToastTone } from '@/contexts/ToastContext'
import { cn } from '@/lib/cn'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

const DISMISS_AFTER_MS = 4500
const MAX_VISIBLE = 3

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: 'text-emerald-600' },
  error: { icon: CircleAlert, className: 'text-red-600' },
  info: { icon: Info, className: 'text-blue-600' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = ++nextId.current
      setToasts((current) => [...current, { id, message, tone }].slice(-MAX_VISIBLE))
      timers.current.set(id, window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS))
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
    }),
    [show],
  )

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className={cn(
          'pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4',
          // Above the mobile tab bar; top-right on desktop
          'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:top-6 lg:right-6 lg:bottom-auto lg:items-end',
        )}
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = toneStyles[toast.tone]
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-surface p-4 text-sm font-medium text-slate-800 shadow-lg ring-1 ring-slate-900/10"
            >
              <Icon className={cn('mt-px size-5 shrink-0', className)} aria-hidden />
              <p className="flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="-m-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss notification"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}
