import { readFileSync } from 'node:fs'
import nspell from 'nspell'
import { describe, expect, it } from 'vitest'
import { fixFor, suggestionFor } from './spelling'

// The suggestion rule against the real dictionary (public/dict/).
const spell = nspell(readFileSync('public/dict/en.aff', 'utf8'), readFileSync('public/dict/en.dic', 'utf8'))

describe('spelling suggestions', () => {
  it('fixes clear typos', () => {
    const fixes = Object.fromEntries(['teh', 'adn', 'thier', 'recieve', 'definately', 'occured', 'seperate', 'freind'].map((w) => [w, fixFor(spell, w)]))
    expect(fixes).toEqual({ teh: 'the', adn: 'and', thier: 'their', recieve: 'receive', definately: 'definitely', occured: 'occurred', seperate: 'separate', freind: 'friend' })
  })
  it('capitalises a name, day, month or language written in lowercase', () => {
    expect(['october', 'monday', 'english'].map((w) => fixFor(spell, w))).toEqual(['October', 'Monday', 'English'])
  })
  it('never touches a real word, a name, or an ambiguous typo', () => {
    for (const w of ['form', 'colour', 'color', 'jot', 'Kubernetes', 'wierd', 'alot', 'ok', 'x2']) expect(fixFor(spell, w)).toBeNull()
  })
  it('checks a capitalised word only where a sentence starts, and keeps the capital', () => {
    expect(suggestionFor(spell, 'Teh', '')).toBe('The')
    expect(suggestionFor(spell, 'Teh', 'It works. ')).toBe('The')
    expect(suggestionFor(spell, 'Teh', '## ')).toBe('The')
    expect(suggestionFor(spell, 'Teh', '- ')).toBe('The')
    expect(suggestionFor(spell, 'Teh', 'I met ')).toBeNull()
    expect(suggestionFor(spell, 'TEH', '')).toBeNull()
    expect(suggestionFor(spell, 'teh', 'I met ')).toBe('the')
  })
})
