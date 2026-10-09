import { useState, type ReactNode } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { controlClasses } from '@/components/forms/controlStyles'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: ReactNode
  children?: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  error?: string | null
  /** When set, the person must type this text to enable the confirm button. */
  confirmText?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  tone = 'danger',
  loading = false,
  error,
  confirmText,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const matches = !confirmText || typed.trim() === confirmText.trim()

  function close() {
    setTyped('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => void onConfirm()}
            loading={loading}
            disabled={!matches}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-slate-600">
        {error && <Alert tone="error">{error}</Alert>}
        {children}
        {confirmText && (
          <label className="block">
            <span className="mb-1.5 block font-semibold text-slate-700">
              Type <span className="font-bold text-slate-900">{confirmText}</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className={controlClasses(false)}
              autoComplete="off"
              autoCapitalize="none"
            />
          </label>
        )}
      </div>
    </Dialog>
  )
}
