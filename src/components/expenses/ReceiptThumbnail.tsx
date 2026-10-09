import { useCallback, useState } from 'react'
import { Maximize2, ReceiptText } from 'lucide-react'
import { ReceiptViewer } from '@/components/expenses/ReceiptViewer'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { getReceiptUrl } from '@/services/storageService'

/** A receipt preview that opens full screen; loads a short-lived signed URL. */
export function ReceiptThumbnail({ path, title }: { path: string; title: string }) {
  const load = useCallback(() => getReceiptUrl(path), [path])
  const { data: url, error } = useAsync(load)
  const [viewing, setViewing] = useState(false)

  if (error && !url) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <ReceiptText className="size-4" aria-hidden />
        The receipt couldn’t be loaded.
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setViewing(true)}
        disabled={!url}
        className="group relative block h-40 w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
        aria-label="View receipt full screen"
      >
        {url ? (
          <img src={url} alt={`Receipt for ${title}`} className="size-full object-cover object-top transition group-hover:scale-[1.02]" />
        ) : (
          <span className="flex size-full items-center justify-center text-blue-600">
            <Spinner />
          </span>
        )}
        {url && (
          <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-semibold text-white">
            <Maximize2 className="size-3.5" aria-hidden />
            View
          </span>
        )}
      </button>
      <ReceiptViewer url={viewing ? (url ?? null) : null} onClose={() => setViewing(false)} title={`Receipt · ${title}`} />
    </>
  )
}
