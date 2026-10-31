import { describe, expect, it } from 'vitest'
import { matchScore, snippet } from './palette'

describe('palette matching', () => {
  it('scores a start above a word start above anywhere', () => {
    expect(matchScore('toggle sidebar', 'tog')).toBe(3)
    expect(matchScore('settings: toggle animations', 'tog')).toBe(2)
    expect(matchScore('jot-todo', 'tod')).toBe(2)
    expect(matchScore('export as pdf', 'df')).toBe(1)
    expect(matchScore('settings', 'xyz')).toBe(0)
  })
  it('cuts a snippet around the hit and keeps the range on it', () => {
    const s = snippet('add a toggle for the minimap to the status bar please', [6, 12], 3)
    expect(s.text.slice(s.range[0], s.range[1])).toBe('toggle')
    expect(s.text.startsWith('…')).toBe(true)
  })
})
