import { describe, expect, it } from 'vitest'
import { countText } from './counts'

describe('word count', () => {
  it('counts English words', () => {
    expect(countText("It's a well-known fact.").words).toBe(4)
  })
  it('keeps a Farsi word whole across the half-space and vowel marks', () => {
    expect(countText('می‌روم').words).toBe(1)
    expect(countText('کتاب‌ها را می‌خوانم').words).toBe(3)
    expect(countText('کِتاب').words).toBe(1)
  })
  it('counts characters as code points, half-spaces included', () => {
    expect(countText('می‌روم').chars).toBe(6)
  })
})
