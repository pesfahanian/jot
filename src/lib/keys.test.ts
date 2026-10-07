import { describe, expect, it } from 'vitest'
import { shortcutKey } from './keys'

describe('shortcutKey', () => {
  it('reads the letter typed on a Latin layout', () => {
    expect(shortcutKey({ key: 's', code: 'KeyS' })).toBe('s')
    expect(shortcutKey({ key: 'V', code: 'KeyV' })).toBe('v')
    // AZERTY: the key labelled A sits where QWERTY has Q.
    expect(shortcutKey({ key: 'a', code: 'KeyQ' })).toBe('a')
  })
  it('falls back to the physical key on a Persian layout', () => {
    expect(shortcutKey({ key: 'س', code: 'KeyS' })).toBe('s')
    expect(shortcutKey({ key: 'ر', code: 'KeyV' })).toBe('v')
    expect(shortcutKey({ key: '۱', code: 'Digit1' })).toBe('1')
  })
  it('leaves named keys alone', () => {
    expect(shortcutKey({ key: 'Escape', code: 'Escape' })).toBe('escape')
  })
})
