import type NSpell from 'nspell'

// Spelling suggestions (Phase 16, made suggestions on 2026-11-15; research
// in docs/research/phase-16-2026-10.md): a merged en_US + en_GB Hunspell
// dictionary (public/dict/, built by scripts/build-dictionary.mjs), loaded
// only when the setting is on. A page can't read the browser's own
// spellchecker, so Jot carries one. Nothing changes until the person clicks
// a suggestion (editor/spelling.ts).
//
// Any word the dictionary doesn't know is marked when a fix is near enough
// (owner, 2026-11-16: best guess, like the browser's first suggestion). The
// dictionary's suggestions come in no useful order, so Jot ranks them:
// first by the kind of slip — two letters swapped, a letter left out, a
// neighbouring key — then by how common the word is (en.freq, SCOWL's
// levels), then by the dictionary's own order. "happend" → "happened" (a
// letter left out) before "happens" (a neighbouring key). A real word is
// never marked, so "form" for "from" is left alone.
//
// The top suggestion is what a click applies; the right-click menu offers
// the next few. A fix is "sure" when nothing else comes close — "fix all"
// applies only those, so a batch never makes a silent wrong guess.

// Typos whose best fix is wrong ("alot" is two words, not "alto").
const NEVER = new Set(['alot'])

let speller: Promise<NSpell> | null = null

export function loadSpeller(): Promise<NSpell> {
  speller ??= Promise.all([
    import('nspell'),
    fetch('/dict/en.aff').then((r) => r.text()),
    fetch('/dict/en.dic').then((r) => r.text()),
    fetch('/dict/en.freq')
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ]).then(([{ default: nspell }, aff, dic, freq]) => {
    setFrequencies(freq)
    return nspell(aff, dic)
  })
  speller.catch(() => (speller = null))
  return speller
}

// How common each word is: its SCOWL level (10 the most common, to 50).
let levels = new Map<string, number>()
export function setFrequencies(text: string) {
  levels = new Map()
  for (const line of text.split('\n')) {
    const [level, ...words] = line.split(' ')
    for (const w of words) levels.set(w, Number(level))
  }
}
// A small push down the list for rarer words; one not listed is rarer still.
const RARITY: Record<number, number> = { 10: 0, 20: 0.1, 35: 0.2, 40: 0.25, 50: 0.3 }
const rarity = (w: string) => RARITY[levels.get(w) ?? levels.get(w.toLowerCase()) ?? 0] ?? 0.45

// The cost of each kind of slip (a weighted Damerau–Levenshtein distance
// from what was typed to the candidate). Lower is likelier.
// A doubled letter typed once or once too often ("usefull", "comited")
// and a contraction's missing apostrophe ("dont") are the commonest of all.
const COST = { swap: 0.5, doubled: 0.5, apostrophe: 0.3, missing: 0.7, neighbour: 0.8, extra: 0.9, other: 1 }
// Beyond this the candidate is a different word, not a fix.
const MAX_COST = 2.2

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const NEIGHBOURS = new Map<string, Set<string>>()
ROWS.forEach((row, r) =>
  [...row].forEach((ch, c) => {
    const near = new Set<string>()
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, -1], [1, 0]]) {
      const k = ROWS[r + dr]?.[c + dc]
      if (k) near.add(k)
    }
    NEIGHBOURS.set(ch, near)
  }),
)

export function slipCost(typed: string, word: string): number {
  const a = typed.toLowerCase()
  const b = word.toLowerCase()
  // A capital alone ("october" → "October") is barely a change.
  const caseOnly = a === b ? 0.05 : 0
  const d: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  // Typed a letter too many; left one out.
  const extra = (i: number) => (i > 1 && a[i - 1] === a[i - 2] ? COST.doubled : COST.extra)
  const missing = (j: number) => (b[j - 1] === "'" ? COST.apostrophe : j > 1 && b[j - 1] === b[j - 2] ? COST.doubled : COST.missing)
  for (let i = 1; i <= a.length; i++) d[i][0] = d[i - 1][0] + extra(i)
  for (let j = 1; j <= b.length; j++) d[0][j] = d[0][j - 1] + missing(j)
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : NEIGHBOURS.get(a[i - 1])?.has(b[j - 1]) ? COST.neighbour : COST.other
      d[i][j] = Math.min(d[i - 1][j] + extra(i), d[i][j - 1] + missing(j), d[i - 1][j - 1] + sub)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + COST.swap)
    }
  return d[a.length][b.length] + caseOnly
}

export interface Suggestion {
  // Best first; the first is what a click applies.
  fixes: string[]
  // Nothing else comes close: safe for "fix all".
  sure: boolean
}

// Sure: one small slip away (a swap, a missing or doubled letter, a
// neighbouring key, a capital), and nothing else close behind.
const SURE_GAP = 0.25
const SURE_COST = 0.8
const SHOWN = 4

// Each word is looked up once per dictionary: suggest() is slow, and a
// document repeats its words.
const memo = new WeakMap<object, Map<string, Suggestion | null>>()

export function suggestionsFor(spell: Pick<NSpell, 'correct' | 'suggest'>, word: string): Suggestion | null {
  let known = memo.get(spell)
  if (!known) memo.set(spell, (known = new Map()))
  if (known.has(word)) return known.get(word)!
  const found = rank(spell, word)
  known.set(word, found)
  return found
}

// The best fix alone (tests, and anything that needs one word).
export const fixFor = (spell: Pick<NSpell, 'correct' | 'suggest'>, word: string) => suggestionsFor(spell, word)?.fixes[0] ?? null

function rank(spell: Pick<NSpell, 'correct' | 'suggest'>, word: string): Suggestion | null {
  if (word.length < 3 || !/^[a-z]+$/.test(word) || NEVER.has(word) || spell.correct(word)) return null
  const candidates = [...new Set(spell.suggest(word))].filter((s) => s !== word && /^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(s))
  const scored = candidates
    .map((s, i) => ({ s, edit: slipCost(word, s), i }))
    .filter((c) => c.edit <= MAX_COST)
    .map((c) => ({ s: c.s, score: c.edit + rarity(c.s) + c.i * 0.001 }))
    .sort((x, y) => x.score - y.score)
  if (!scored.length) return null
  const best = scored[0]
  const sure = slipCost(word, best.s) <= SURE_COST && (scored.length === 1 || scored[1].score - best.score >= SURE_GAP)
  return { fixes: scored.slice(0, SHOWN).map((c) => c.s), sure }
}

// A capitalised word is checked only where a sentence starts (a line's
// start, after a list or heading marker, or after . ! ?); anywhere else
// it's most likely a name. The fixes keep the capital.
const SENTENCE_START = /(^|[.!?]["')\]]?\s+|^\s*(#{1,6}|[-*+>]|\d+[.)])\s+)$/

export function suggestionFor(spell: Pick<NSpell, 'correct' | 'suggest'>, word: string, before: string): Suggestion | null {
  if (/^[a-z]+$/.test(word)) return suggestionsFor(spell, word)
  if (!/^[A-Z][a-z]+$/.test(word) || !SENTENCE_START.test(before) || spell.correct(word)) return null
  const found = suggestionsFor(spell, word.toLowerCase())
  if (!found) return null
  // "Tuesday" checked as "tuesday" comes back as itself: not a typo.
  const fixes = [...new Set(found.fixes.map((f) => f[0].toUpperCase() + f.slice(1)))].filter((f) => f !== word)
  return fixes.length ? { fixes, sure: found.sure && fixes.length === found.fixes.length } : null
}
