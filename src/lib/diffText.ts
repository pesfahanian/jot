import { Change, diff } from '@codemirror/merge'

// The diff checker's comparison rules: precision (whole words, or single
// characters) and whether whitespace counts. CodeMirror's merge view diffs
// character by character; for words, or with whitespace ignored, the text
// is cut into tokens first, each distinct token stands in as one symbol,
// the symbols are diffed, and the result is mapped back to characters.

export type Precision = 'word' | 'char'

// A word runs through vowel marks and the Farsi half-space, as in counts.ts.
const WORD = /\s+|[\p{L}\p{M}\p{N}_](?:[\p{L}\p{M}\p{N}_]|‌|‍)*|[\s\S]/gu
const CHAR = /\s+|[\s\S]/gu

interface Tokens {
  keys: string[]
  from: number[]
  to: number[]
}

function tokenize(text: string, precision: Precision, ignoreWhitespace: boolean): Tokens {
  const out: Tokens = { keys: [], from: [], to: [] }
  for (const m of text.matchAll(precision === 'word' ? WORD : CHAR)) {
    const ws = /^\s+$/.test(m[0])
    if (ws && ignoreWhitespace) continue
    // In character precision a whitespace run still counts per character.
    const parts = ws && precision === 'char' ? [...m[0]] : [m[0]]
    let at = m.index
    for (const p of parts) {
      out.keys.push(p)
      out.from.push(at)
      out.to.push(at + p.length)
      at += p.length
    }
  }
  return out
}

// One symbol per distinct token, from the private-use area then the CJK
// block; null when a text has more distinct tokens than that.
function symbols(a: Tokens, b: Tokens): [string, string] | null {
  const ids = new Map<string, string>()
  const sym = (k: string) => {
    let s = ids.get(k)
    if (s === undefined) {
      const i = ids.size
      if (i >= 6400 + 20992) return null
      s = String.fromCharCode(i < 6400 ? 0xe000 + i : 0x4e00 + i - 6400)
      ids.set(k, s)
    }
    return s
  }
  let sa = ''
  let sb = ''
  for (const k of a.keys) {
    const s = sym(k)
    if (s === null) return null
    sa += s
  }
  for (const k of b.keys) {
    const s = sym(k)
    if (s === null) return null
    sb += s
  }
  return [sa, sb]
}

// Where token index i starts, in characters (the end, past the last).
const at = (t: Tokens, i: number, text: string) => (i < t.from.length ? t.from[i] : t.to.length ? t.to[t.to.length - 1] : text.length)

export function diffText(a: string, b: string, precision: Precision, ignoreWhitespace: boolean): readonly Change[] {
  if (precision === 'char' && !ignoreWhitespace) return diff(a, b)
  const ta = tokenize(a, precision, ignoreWhitespace)
  const tb = tokenize(b, precision, ignoreWhitespace)
  const syms = symbols(ta, tb)
  if (!syms) return diff(a, b)
  return diff(syms[0], syms[1]).map(
    (c) =>
      new Change(
        at(ta, c.fromA, a),
        c.toA > c.fromA ? ta.to[c.toA - 1] : at(ta, c.fromA, a),
        at(tb, c.fromB, b),
        c.toB > c.fromB ? tb.to[c.toB - 1] : at(tb, c.fromB, b),
      ),
  )
}

// The merge view's override for a set of choices; undefined is its own
// character diff.
export function diffOverride(precision: Precision, ignoreWhitespace: boolean) {
  if (precision === 'char' && !ignoreWhitespace) return undefined
  return (a: string, b: string) => diffText(a, b, precision, ignoreWhitespace)
}
