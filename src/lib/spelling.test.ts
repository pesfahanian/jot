import { readFileSync } from 'node:fs'
import nspell from 'nspell'
import { describe, expect, it } from 'vitest'
import { fixFor, setFrequencies, suggestionFor, suggestionsFor } from './spelling'

// The suggestion ranking against the real dictionary and word levels
// (public/dict/).
const spell = nspell(readFileSync('public/dict/en.aff', 'utf8'), readFileSync('public/dict/en.dic', 'utf8'))
setFrequencies(readFileSync('public/dict/en.freq', 'utf8'))

describe('spelling suggestions', () => {
  it('puts the likeliest fix first', () => {
    const words = ['teh', 'adn', 'thier', 'recieve', 'definately', 'occured', 'seperate', 'freind', 'happend', 'wierd', 'cannpt', 'usefull', 'wouldnt', 'dont', 'realy', 'helo']
    expect(Object.fromEntries(words.map((w) => [w, fixFor(spell, w)]))).toEqual({
      teh: 'the',
      adn: 'and',
      thier: 'their',
      recieve: 'receive',
      definately: 'definitely',
      occured: 'occurred',
      seperate: 'separate',
      freind: 'friend',
      happend: 'happened',
      wierd: 'weird',
      cannpt: 'cannot',
      usefull: 'useful',
      wouldnt: "wouldn't",
      dont: "don't",
      realy: 'really',
      helo: 'hello',
    })
  })
  it('is sure only when nothing else comes close', () => {
    expect(suggestionsFor(spell, 'teh')?.sure).toBe(true)
    expect(suggestionsFor(spell, 'recieve')?.sure).toBe(true)
    // happened, happens, happen: a click takes the first; fix all leaves it.
    expect(suggestionsFor(spell, 'happend')).toMatchObject({ fixes: ['happened', 'happens', 'happen', 'append'], sure: false })
  })
  it('capitalises a name, day, month or language written in lowercase', () => {
    expect(['october', 'monday', 'english'].map((w) => fixFor(spell, w))).toEqual(['October', 'Monday', 'English'])
  })
  it('never marks a real word, a name, or a word it has no near fix for', () => {
    for (const w of ['form', 'colour', 'color', 'jot', 'Kubernetes', 'kubernetes', 'alot', 'ok', 'x2']) expect(fixFor(spell, w)).toBeNull()
  })
  it('checks a capitalised word only where a sentence starts, and keeps the capital', () => {
    const first = (word: string, before: string) => suggestionFor(spell, word, before)?.fixes[0] ?? null
    expect(first('Teh', '')).toBe('The')
    expect(first('Teh', 'It works. ')).toBe('The')
    expect(first('Teh', '## ')).toBe('The')
    expect(first('Teh', '- ')).toBe('The')
    expect(first('Teh', 'I met ')).toBeNull()
    expect(first('TEH', '')).toBeNull()
    expect(first('teh', 'I met ')).toBe('the')
    // Already right, at a sentence's start or anywhere: never marked.
    expect(first('Tuesday', '')).toBeNull()
    expect(first('Thursday', 'It was. ')).toBeNull()
  })
})
