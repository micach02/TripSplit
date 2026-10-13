/*
 * TripSplit service worker: lets the installed app open without a connection.
 *
 * - Pages: network first, so a new deploy shows up straight away; offline, the
 *   saved copy of the app shell (index.html) is served instead. The shell is
 *   saved together with the script and stylesheet it starts, and refreshed
 *   after each online page load.
 * - Built files under assets/: their names change with every build, so a saved
 *   copy is always right. Saved as they're fetched (the app prefetches the
 *   common screens), so screens you've opened before also work offline.
 * - Fonts: saved on first use, so the app looks the same offline.
 * - Everything else, including Supabase, goes straight to the network. Offline
 *   data is handled by the app itself (cached lists, and an outbox for new
 *   expenses).
 */
const VERSION = 'v1'
const SHELL_CACHE = `tripsplit-shell-${VERSION}`
const ASSET_CACHE = `tripsplit-assets-${VERSION}`
const FONT_CACHE = `tripsplit-fonts-${VERSION}`
const KEEP = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE]
// Old builds' files pile up across deploys; keep the newest this many.
const MAX_ASSETS = 250

const scope = self.registration.scope
const SHELL_URL = scope
const ASSETS_PREFIX = `${scope}assets/`
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', (event) => {
  event.waitUntil(saveShell('reload').then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('tripsplit-') && !KEEP.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (request.mode === 'navigate' && request.url.startsWith(scope)) {
    event.respondWith(page(event))
  } else if (request.url.startsWith(ASSETS_PREFIX)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, trimAssets))
  } else if (FONT_HOSTS.includes(new URL(request.url).hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE))
  }
})

/**
 * Saves the shell and the files it starts with. The root is fetched on its own
 * because GitHub Pages answers deep links with 404.html (a copy of the shell).
 */
async function saveShell(httpCache = 'default') {
  const response = await fetch(SHELL_URL, { cache: httpCache })
  if (!response.ok) return
  const html = await response.clone().text()
  const starters = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((match) => new URL(match[1], SHELL_URL).href)
  const assets = await caches.open(ASSET_CACHE)
  await Promise.all(starters.map(async (url) => (await assets.match(url)) || assets.add(url)))
  // Last, so the saved shell never points at files that aren't saved.
  await (await caches.open(SHELL_CACHE)).put(SHELL_URL, response)
}

async function page(event) {
  try {
    const response = await fetch(event.request)
    event.waitUntil(saveShell().catch(() => undefined))
    return response
  } catch (error) {
    const cached = await caches.match(SHELL_URL)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request, cacheName, afterPut) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  // Opaque: a cross-origin font stylesheet fetched without CORS; still usable.
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
    if (afterPut) afterPut(cache).catch(() => undefined)
  }
  return response
}

async function trimAssets(cache) {
  const keys = await cache.keys()
  // Oldest first: a cache lists entries in the order they were added.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)))
}
