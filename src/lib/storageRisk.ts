// Which browsers delete Jot's storage on their own (data safety research,
// docs/todo.md). Safari's tracking prevention deletes everything a site
// stored after 7 days of Safari use with no click, tap or keypress there —
// and it's the WebKit engine that does it, so every browser on iPad does
// too (they're all WebKit), and so does Orion on Mac. Chromium browsers and
// Firefox don't.
//
// The one documented exemption is a site installed to the iPad Home Screen.
// Mac Dock apps aren't documented either way, so they still get the warning.
// Asking for persistent storage isn't known to help, so it changes nothing.

export type StorageRisk = 'mac' | 'ipad' | null

interface Env {
  vendor: string
  maxTouchPoints: number
  standalone: boolean
}

export function storageRisk(env: Env): StorageRisk {
  if (env.vendor !== 'Apple Computer, Inc.') return null
  // iPadOS reports itself as a Mac; touch gives it away.
  const touch = env.maxTouchPoints > 1
  if (touch) return env.standalone ? null : 'ipad'
  return 'mac'
}

export function currentStorageRisk(): StorageRisk {
  return storageRisk({
    vendor: navigator.vendor,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
  })
}

export const WARNING_RETURNS_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export const warningDue = (dismissedAt: number | null | undefined, now = Date.now()) => !dismissedAt || now - dismissedAt >= WARNING_RETURNS_AFTER_MS
