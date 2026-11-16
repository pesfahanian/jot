// Jot's service worker, written into the build as /sw.js by the offline
// plugin in vite.config.ts, which fills in the version and the file list.
//
// The whole app is kept in the browser after one good load, so Jot opens,
// renders and prints with no network at all — for a connection that can't
// reach the host, or none. Nothing else is cached: a document's images and
// translation calls go to the network as before.
//
// A new version installs in the background and waits; the page offers to
// switch (lib/offline.ts), or it takes over once every Jot tab is closed.

const VERSION = __VERSION__
const FILES = __FILES__
const CACHE = `jot-${VERSION}`

// A redirected answer can't open a page in Chromium browsers (ERR_FAILED),
// so anything the host redirected is kept as a plain copy of where it led.
const plain = async (response) =>
  response.redirected ? new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers }) : response

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        FILES.map(async (f) => {
          const response = await fetch(new Request(f, { cache: 'reload' }))
          if (!response.ok) throw new Error(`${f}: ${response.status}`)
          await cache.put(f, await plain(response))
        }),
      ),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jot-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Opening Jot: the kept page, whatever the address — the app has no other
  // pages.
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('/', { cacheName: CACHE }).then((kept) => (kept ? plain(kept) : fetch(request))))
    return
  }
  event.respondWith(caches.match(url.pathname, { cacheName: CACHE }).then((kept) => (kept ? plain(kept) : fetch(request))))
})
