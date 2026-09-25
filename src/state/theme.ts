import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useSyncExternalStore } from 'react'
import { db, type Settings } from '@/lib/db'
import { defaultSettings, updateSettings } from '@/lib/settings'

export type ThemePreference = Settings['theme']

const media = window.matchMedia('(prefers-color-scheme: dark)')
const subscribeOs = (fn: () => void) => {
  media.addEventListener('change', fn)
  return () => media.removeEventListener('change', fn)
}

// The saved preference (default system, 3f) and what it resolves to right
// now. `system` follows the OS live, with no reload.
export interface ThemeState {
  preference: ThemePreference
  resolved: 'light' | 'dark'
}

export function useTheme(): ThemeState {
  const preference = useLiveQuery(() => db.settings.get('settings').then((s) => s?.theme ?? defaultSettings.theme), []) ?? 'system'
  const osDark = useSyncExternalStore(subscribeOs, () => media.matches)
  const resolved = preference === 'system' ? (osDark ? 'dark' : 'light') : preference
  return { preference, resolved }
}

// Applies the resolved theme to <html>. Only the class changes — every
// surface reads the palette from CSS variables (ADR-006).
export function useApplyTheme(resolved: 'light' | 'dark') {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])
}

const order: ThemePreference[] = ['light', 'dark', 'system']
export function cycleTheme(current: ThemePreference) {
  return updateSettings({ theme: order[(order.indexOf(current) + 1) % order.length] })
}
