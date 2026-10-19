import { describe, expect, it } from 'vitest'
import { browserOwns, formatKey, isCommandKey, isMac, keyOfEvent, normKey } from './shortcuts'

// Mod is ⌘ on a Mac and Ctrl elsewhere; the test follows the platform it
// runs on.
const mod = isMac ? { metaKey: true } : { ctrlKey: true }

describe('shortcut keys', () => {
  it('normalise to one form', () => {
    expect(normKey('Shift-Mod-l')).toBe('Mod-Shift-l')
    expect(normKey('Mod-Alt-Shift-N')).toBe('Mod-Alt-Shift-n')
    expect(normKey('Cmd-k')).toBe(isMac ? 'Mod-k' : 'Meta-k')
  })
  it('read a key press, by the physical key on a non-Latin layout or under ⌥', () => {
    // The test runs without a DOM: a plain object stands in for the event.
    const e = (init: Partial<KeyboardEvent>) => ({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...init }) as KeyboardEvent
    expect(keyOfEvent(e({ key: 'k', code: 'KeyK', ...mod }))).toBe('Mod-k')
    expect(keyOfEvent(e({ key: 'ن', code: 'KeyK', ...mod }))).toBe('Mod-k')
    expect(keyOfEvent(e({ key: '˜', code: 'KeyN', altKey: true, ...mod }))).toBe('Mod-Alt-n')
    expect(keyOfEvent(e({ key: ',', code: 'Comma', ...mod }))).toBe('Mod-,')
    expect(keyOfEvent(e({ key: 'Meta', code: 'MetaLeft', metaKey: true }))).toBeNull()
  })
  it('show and judge keys', () => {
    expect(formatKey('Mod-Alt-Shift-n')).toBe(isMac ? '⌥⇧⌘N' : 'Ctrl+Alt+Shift+N')
    expect(isCommandKey('Shift-a')).toBe(false)
    expect(isCommandKey('Mod-b')).toBe(true)
    expect(isCommandKey('Alt-n')).toBe(!isMac)
    expect(browserOwns('Mod-w')).toBe(true)
    expect(browserOwns('Mod-3')).toBe(true)
    expect(browserOwns('Mod-k')).toBe(false)
  })
})
