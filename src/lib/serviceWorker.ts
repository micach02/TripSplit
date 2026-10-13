/**
 * Registers public/sw.js, which lets the installed app open offline. Production
 * builds only: in development it would serve stale files over Vite's live ones.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL
  // After load, so it doesn't compete with the first screen for the network.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Not fatal: the app works the same online, just not offline.
    })
  })
}
