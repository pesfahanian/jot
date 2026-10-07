import { describe, expect, it } from 'vitest'
import { anchorQuote } from './anchor'

// Model quotes, anchored to the document — exactly, across reflowed
// whitespace, and (Farsi) across the characters models retype.

describe('anchorQuote', () => {
  it('finds an exact quote, and the first unclaimed of several', () => {
    const t = 'one two one two'
    expect(anchorQuote(t, 'one')).toEqual({ start: 0, end: 3 })
    expect(anchorQuote(t, 'one', [{ start: 0, end: 3 }])).toEqual({ start: 8, end: 11 })
  })
  it('tolerates reflowed whitespace', () => {
    expect(anchorQuote('a long\nline here', 'long line')).toEqual({ start: 2, end: 11 })
  })
  it('finds a Farsi quote whose half-space the model dropped or turned into a space', () => {
    const t = 'ما فردا می‌رویم و کتاب‌ها را می‌خوانیم'
    const r = anchorQuote(t, 'می رویم')!
    expect(t.slice(r.start, r.end)).toBe('می‌رویم')
    const r2 = anchorQuote(t, 'کتابها')!
    expect(t.slice(r2.start, r2.end)).toBe('کتاب‌ها')
  })
  it('finds a Farsi quote typed with Arabic ي / ك', () => {
    const t = 'این یک کتاب است'
    const r = anchorQuote(t, 'يك كتاب')!
    expect(t.slice(r.start, r.end)).toBe('یک کتاب')
  })
  it("still returns nothing for text that isn't there", () => {
    expect(anchorQuote('این یک کتاب است', 'آن دفتر')).toBeNull()
  })
})
