import { useCallback, useEffect, useMemo, useState } from 'react'

interface Settled<T> {
  request: object
  data?: T
  error?: unknown
}

export interface AsyncState<T> {
  /** Latest successful result — kept while reloading so the screen doesn't flash. */
  data: T | undefined
  error: unknown
  loading: boolean
  reload: () => void
}

/**
 * Runs `load` and tracks its result. `load` must be memoised (useCallback);
 * it re-runs whenever its identity changes or `reload()` is called.
 * Responses from superseded requests are ignored.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const [lastData, setLastData] = useState<T | undefined>(undefined)

  // A fresh object per request, used to recognise which request settled.
  const request = useMemo(() => ({ load, attempt }), [load, attempt])

  useEffect(() => {
    let cancelled = false
    request.load().then(
      (data) => {
        if (cancelled) return
        setSettled({ request, data })
        setLastData(data)
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ request, error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [request])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])
  const isCurrent = settled?.request === request

  return {
    data: lastData,
    error: isCurrent ? settled.error : undefined,
    loading: !isCurrent,
    reload,
  }
}
