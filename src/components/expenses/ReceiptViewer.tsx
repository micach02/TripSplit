import { useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'

interface ReceiptViewerProps {
  url: string | null
  onClose: () => void
  title?: string
}

/** Full-screen receipt view (native <dialog>: Esc closes, focus is trapped). */
export function ReceiptViewer({ url, onClose, title = 'Receipt' }: ReceiptViewerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const open = url !== null

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-scrim/95 p-0 text-white backdrop:bg-scrim/80"
    >
      {url && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <p className="truncate text-sm font-semibold text-white/90">{title}</p>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full p-2.5 text-sm font-semibold whitespace-nowrap text-white/90 hover:bg-white/10 sm:px-3 sm:py-2"
              >
                <ExternalLink className="size-5 sm:size-4" aria-hidden />
                {/* Icon only on phones, so the title keeps its room */}
                <span className="max-sm:sr-only">Open original</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2.5 text-white/90 hover:bg-white/10"
                aria-label="Close receipt"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose()
            }}
          >
            <img src={url} alt={title} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </dialog>
  )
}
