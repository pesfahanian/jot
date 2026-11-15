import { useSyncExternalStore } from 'react'

// The service worker (scripts/sw.template.js, built into /sw.js): after one
// good load the whole app is kept in this browser, so Jot opens and renders
// without reaching the host. Production builds only.
//
// A new version downloads in the background and waits. The status bar then
// offers it ("updated · reload"); otherwise it takes over once every Jot tab
// has been closed. A tab left open for days still looks for one hourly.

const CHECK_EVERY = 60 * 60 * 1000

let waiting: ServiceWorker | null = null
const listeners = new Set<() => void>()
const setWaiting = (w: ServiceWorker | null) => {
  waiting = w
  for (const l of listeners) l()
}

export function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      // A version that finished installing before this page loaded.
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        next?.addEventListener('statechange', () => {
          // The first install has nothing to replace: no offer.
          if (next.state === 'installed' && navigator.serviceWorker.controller) setWaiting(next)
        })
      })
      setInterval(() => void reg.update().catch(() => {}), CHECK_EVERY)
    })
    .catch(() => {})
  // The new version took over (this tab asked, or another did): reload into
  // it, so this page never runs against the other version's files.
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !waiting) return
    reloading = true
    location.reload()
  })
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => waiting !== null,
  )
}

// Every edit is already saved (ADR-008), so reloading loses nothing.
export function applyUpdate() {
  waiting?.postMessage('skip-waiting')
}
