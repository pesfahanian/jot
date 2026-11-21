import { describe, expect, it } from 'vitest'
import { Lru } from './lru'

describe('Lru', () => {
  it('keeps the most recently used, dropping the oldest', () => {
    const c = new Lru<number>(2)
    c.set('a', 1)
    c.set('b', 2)
    expect(c.get('a')).toBe(1) // a is now newer than b
    c.set('c', 3)
    expect([c.has('a'), c.has('b'), c.has('c')]).toEqual([true, false, true])
    expect(c.size).toBe(2)
  })
})
