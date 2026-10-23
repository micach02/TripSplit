import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '@/routes/paths'

/** True while someone is typing somewhere, so "/" stays a character there. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** "/" or Ctrl/⌘ K opens Search from anywhere in the app. */
export function useSearchShortcut(): void {
  const navigate = useNavigate()
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)
      if (!commandK && !slash) return
      // Not while a dialog is open: it owns the keyboard.
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      navigate(paths.search)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])
}
