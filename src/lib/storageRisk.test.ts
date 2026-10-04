import { describe, expect, it } from 'vitest'
import { storageRisk, WARNING_RETURNS_AFTER_MS, warningDue } from './storageRisk'

// Who sees the storage warning: anything on Apple's engine, except an
// installed iPad Home Screen app.

const APPLE = 'Apple Computer, Inc.'

describe('storageRisk', () => {
  it('warns Safari on Mac, installed to the Dock or not', () => {
    expect(storageRisk({ vendor: APPLE, maxTouchPoints: 0, standalone: false })).toBe('mac')
    expect(storageRisk({ vendor: APPLE, maxTouchPoints: 0, standalone: true })).toBe('mac')
  })

  it('warns every browser on iPad, except a Home Screen app', () => {
    expect(storageRisk({ vendor: APPLE, maxTouchPoints: 5, standalone: false })).toBe('ipad')
    expect(storageRisk({ vendor: APPLE, maxTouchPoints: 5, standalone: true })).toBeNull()
  })

  it('leaves Chromium browsers and Firefox alone', () => {
    expect(storageRisk({ vendor: 'Google Inc.', maxTouchPoints: 0, standalone: false })).toBeNull()
    expect(storageRisk({ vendor: '', maxTouchPoints: 0, standalone: false })).toBeNull()
  })
})

describe('warningDue', () => {
  it('shows until dismissed, then again after 7 days', () => {
    expect(warningDue(null, 0)).toBe(true)
    expect(warningDue(1000, 1000 + WARNING_RETURNS_AFTER_MS - 1)).toBe(false)
    expect(warningDue(1000, 1000 + WARNING_RETURNS_AFTER_MS)).toBe(true)
  })
})
