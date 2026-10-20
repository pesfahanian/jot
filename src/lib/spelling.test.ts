import { readFileSync } from 'node:fs'
import nspell from 'nspell'
import { describe, expect, it } from 'vitest'
import { fixFor } from './spelling'

// The auto-fix rule against the real dictionary (public/dict/).
const spell = nspell(readFileSync('public/dict/en.aff', 'utf8'), readFileSync('public/dict/en.dic', 'utf8'))

describe('auto-fix spelling', () => {
  it('fixes clear typos', () => {
    const fixes = Object.fromEntries(['teh', 'adn', 'thier', 'recieve', 'definately', 'occured', 'seperate', 'freind'].map((w) => [w, fixFor(spell, w)]))
    expect(fixes).toEqual({ teh: 'the', adn: 'and', thier: 'their', recieve: 'receive', definately: 'definitely', occured: 'occurred', seperate: 'separate', freind: 'friend' })
  })
  it('never touches a real word, a name, or an ambiguous typo', () => {
    for (const w of ['form', 'colour', 'color', 'jot', 'Kubernetes', 'wierd', 'alot', 'ok', 'x2']) expect(fixFor(spell, w)).toBeNull()
  })
})
