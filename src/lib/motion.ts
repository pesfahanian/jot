import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useSyncExternalStore } from 'react'
import { getSettings } from './settings'

// Whether the app animates (round 4, motion spec). Off when settings →
// appearance → animations is off, or whenever the system asks for reduced
// motion — then the setting shows off and locked. Applied as
// data-motion="off" on <html>, which zeroes every duration (index.css).

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribe = (fn: () => void) => {
  reduced.addEventListener('change', fn)
  return () => reduced.removeEventListener('change', fn)
}

export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced.matches)
}

export function useMotion(): { on: boolean; setting: boolean; systemReduced: boolean } {
  const setting = useLiveQuery(() => getSettings().then((s) => s.animations ?? true), []) ?? true
  const systemReduced = useSystemReducedMotion()
  return { on: setting && !systemReduced, setting, systemReduced }
}

export function useApplyMotion() {
  const { on } = useMotion()
  useEffect(() => {
    if (on) delete document.documentElement.dataset.motion
    else document.documentElement.dataset.motion = 'off'
  }, [on])
}
