import { useEffect, useRef } from 'react'

/**
 * "Expenses changed behind your back": automatic recurring expenses were added
 * or offline expenses synced. Screens showing money listen and reload.
 */
const EVENT = 'tripsplit:data-changed'

export function emitDataChanged(): void {
  window.dispatchEvent(new Event(EVENT))
}

/** Calls `onChange` whenever data changed elsewhere. */
export function useDataChanged(onChange: () => void): void {
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  })
  useEffect(() => {
    const handler = () => latest.current()
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])
}
