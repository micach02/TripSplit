/**
 * Installing TripSplit as an app. Chrome, Edge and Android offer it through the
 * beforeinstallprompt event, which fires once early on, so it is caught here at
 * startup and kept for the Install button in Settings. iPhones and iPads have no
 * such event: people add the app from Safari's Share menu instead.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unavailable'

let deferred: BeforeInstallPromptEvent | null = null
let installed =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

window.addEventListener('beforeinstallprompt', (event) => {
  deferred = event as BeforeInstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  deferred = null
  installed = true
  notify()
})

export function getInstallState(): InstallState {
  if (installed) return 'installed'
  if (deferred) return 'available'
  return isIos ? 'ios' : 'unavailable'
}

/** Shows the browser's install dialog; true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  // The event can only be used once.
  deferred = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
