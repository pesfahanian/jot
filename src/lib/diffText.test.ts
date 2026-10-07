import { describe, expect, it } from 'vitest'
import { diffText } from './diffText'

// The diff checker's precision and whitespace rules.

const pieces = (a: string, b: string, p: 'word' | 'char', ws = false) => diffText(a, b, p, ws).map((c) => [a.slice(c.fromA, c.toA), b.slice(c.fromB, c.toB)])

describe('diffText', () => {
  it('marks whole words in word precision', () => {
    expect(pieces('Everything stays on this device.', 'Everything stays in this browser.', 'word')).toEqual([
      ['on', 'in'],
      ['device', 'browser'],
    ])
  })
  it('marks single characters in character precision', () => {
    expect(pieces('recieve', 'receive', 'char').flat().join('|')).not.toContain('recieve')
  })
  it('treats a half-spaced Farsi word as one word', () => {
    expect(pieces('ما می‌روم', 'ما می‌رویم', 'word')).toEqual([['می‌روم', 'می‌رویم']])
  })
  it('can ignore whitespace entirely', () => {
    expect(diffText('a  b\tc', 'a b c', 'word', true)).toEqual([])
    expect(diffText('a  b', 'a b', 'char', true)).toEqual([])
    expect(diffText('a  b', 'a b', 'word', false)).not.toEqual([])
  })
  it('still finds real changes with whitespace ignored', () => {
    expect(pieces('one  two three', 'one two four', 'word', true)).toEqual([['three', 'four']])
  })
  it('handles insertions at the end and empty texts', () => {
    expect(pieces('a', 'a b', 'word')).toEqual([['', ' b']])
    expect(pieces('', 'x', 'word')).toEqual([['', 'x']])
  })
})
