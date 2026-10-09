import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, CircleAlert, ImagePlus, Maximize2, RefreshCw, Trash2 } from 'lucide-react'
import { ReceiptViewer } from '@/components/expenses/ReceiptViewer'
import { Button } from '@/components/ui/Button'
import { useAsync } from '@/hooks/useAsync'
import type { ReceiptChange } from '@/services/expenseService'
import { AVATAR_ACCEPTED_TYPES, getReceiptUrl } from '@/services/storageService'

/** Raw photos straight off a phone; they're shrunk before upload. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const ACCEPT = AVATAR_ACCEPTED_TYPES.join(',')

interface ReceiptPickerProps {
  /** Storage path of the saved receipt (editing) */
  existingPath: string | null
  value: ReceiptChange
  onChange: (change: ReceiptChange) => void
}

export function ReceiptPicker({ existingPath, value, onChange }: ReceiptPickerProps) {
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => (existingPath ? getReceiptUrl(existingPath) : null), [existingPath])
  const { data: existingUrl } = useAsync(load)

  // Release the object URL of a replaced local preview.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const shown = value.kind === 'replace' ? preview : value.kind === 'remove' ? null : (existingUrl ?? null)
  const hasReceipt = value.kind === 'replace' || (value.kind === 'keep' && Boolean(existingPath))

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      setError('Receipts can be JPG, PNG or WEBP photos.')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('That photo is too large. Choose one under 20 MB.')
      return
    }
    setError(null)
    setPreview(URL.createObjectURL(file))
    onChange({ kind: 'replace', file })
  }

  function remove() {
    setPreview(null)
    setError(null)
    onChange(existingPath ? { kind: 'remove' } : { kind: 'keep' })
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">Receipt</p>

      {hasReceipt ? (
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => shown && setViewing(true)}
            className="group relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"
            aria-label="View receipt full screen"
          >
            {shown && <img src={shown} alt="Receipt preview" className="size-full object-cover object-top" />}
            <span className="absolute right-1 bottom-1 rounded-full bg-slate-950/70 p-1 text-white">
              <Maximize2 className="size-3" aria-hidden />
            </span>
          </button>
          <div className="flex flex-col items-start gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => galleryInput.current?.click()}
              icon={<RefreshCw className="size-4" aria-hidden />}
            >
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={remove} icon={<Trash2 className="size-4" aria-hidden />}>
              Remove
            </Button>
            {value.kind === 'replace' && <p className="text-xs text-slate-500">Uploads when you save.</p>}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {/* Phones go straight to the camera; desktop browsers ignore `capture`, so it's hidden there. */}
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden"
              onClick={() => cameraInput.current?.click()}
              icon={<Camera className="size-4" aria-hidden />}
            >
              Take photo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => galleryInput.current?.click()}
              icon={<ImagePlus className="size-4" aria-hidden />}
            >
              <span className="sm:hidden">Choose photo</span>
              <span className="max-sm:hidden">Add receipt</span>
            </Button>
            {value.kind === 'remove' && (
              <Button variant="ghost" size="sm" onClick={() => onChange({ kind: 'keep' })}>
                Undo remove
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {value.kind === 'remove'
              ? 'The receipt will be removed when you save.'
              : 'Optional. JPG, PNG or WEBP — big photos are shrunk for you.'}
          </p>
        </>
      )}

      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600" role="alert">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <input
        ref={cameraInput}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={pick}
      />
      <input
        ref={galleryInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={pick}
        data-testid="receipt-file-input"
      />
      <ReceiptViewer url={viewing ? shown : null} onClose={() => setViewing(false)} />
    </div>
  )
}
