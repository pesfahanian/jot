// The ranking layer of spelling suggestions. It runs inside the speller
// worker (lib/speller.worker.ts), on top of Hunspell (lib/hunspell.ts;
// open decision #30, 2026-11-21 — nspell before). English keeps exactly the
// suggestions it had: the candidates are generated the way nspell did
// (lib/candidates.ts), and the fixture in spelling-fixtures/ holds the
// engine to it.
//
// Spelling suggestions (Phase 16, made suggestions on 2026-11-15; research
// in docs/research/phase-16-2026-10.md): a merged en_US + en_GB Hunspell
// dictionary (public/dict/, built by scripts/build-dictionary.mjs), loaded
// only when the setting is on; other languages from packs (lib/packs.ts).
//
// Any word the dictionary doesn't know is marked when a fix is near enough
// (owner, 2026-11-16: best guess, like the browser's first suggestion). The
// dictionary's suggestions come in no useful order, so Jot ranks them:
// first by the kind of slip — two letters swapped, a letter left out, a
// neighbouring key — then by how common the word is (en.freq, SCOWL's
// levels; English only), then by the dictionary's own order. "happend" →
// "happened" (a letter left out) before "happens" (a neighbouring key). A
// real word is never marked, so "form" for "from" is left alone.
//
// The top suggestion is what a click applies; the right-click menu offers
// the next few. A fix is "sure" when nothing else comes close — "fix all"
// applies only those, so a batch never makes a silent wrong guess.

import { ENGLISH, type SpellLanguage } from './languages'

// What the ranking needs from an engine.
export interface Speller {
  correct(word: string): boolean
  suggest(word: string): string[]
}

// Typos whose best fix is wrong ("alot" is two words, not "alto").
const NEVER = new Set(['alot'])

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
// A wrong accent (é for è, a for ä) is the smallest slip of a letter;
// English, all a–z, never meets it.
const COST = { swap: 0.5, doubled: 0.5, apostrophe: 0.3, accent: 0.3, missing: 0.7, neighbour: 0.8, extra: 0.9, other: 1 }
const base = (ch: string) => ch.normalize('NFD').replace(/\p{M}+/gu, '')
// Beyond this the candidate is a different word, not a fix.
const MAX_COST = 2.2

// Each key's neighbours on a language's keyboard (its rows, offset as on a
// real keyboard).
const neighbourMaps = new Map<string, Map<string, Set<string>>>()
function neighboursOf(lang: SpellLanguage): Map<string, Set<string>> {
  let map = neighbourMaps.get(lang.code)
  if (map) return map
  map = new Map()
  const rows = lang.rows.map((r) => [...r])
  rows.forEach((row, r) =>
    row.forEach((ch, c) => {
      const near = new Set<string>()
      for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, -1], [1, 0]]) {
        const k = rows[r + dr]?.[c + dc]
        if (k) near.add(k)
      }
      map!.set(ch, near)
    }),
  )
  neighbourMaps.set(lang.code, map)
  return map
}

export function slipCost(typed: string, word: string, lang: SpellLanguage = ENGLISH): number {
  const NEIGHBOURS = neighboursOf(lang)
  const a = [...typed.toLowerCase()]
  const b = [...word.toLowerCase()]
  // A capital alone ("october" → "October") is barely a change.
  const caseOnly = a.join('') === b.join('') ? 0.05 : 0
  const d: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  // Typed a letter too many; left one out.
  const extra = (i: number) => (i > 1 && a[i - 1] === a[i - 2] ? COST.doubled : COST.extra)
  const missing = (j: number) => (b[j - 1] === "'" ? COST.apostrophe : j > 1 && b[j - 1] === b[j - 2] ? COST.doubled : COST.missing)
  for (let i = 1; i <= a.length; i++) d[i][0] = d[i - 1][0] + extra(i)
  for (let j = 1; j <= b.length; j++) d[0][j] = d[0][j - 1] + missing(j)
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : base(a[i - 1]) === base(b[j - 1]) ? COST.accent : NEIGHBOURS.get(a[i - 1])?.has(b[j - 1]) ? COST.neighbour : COST.other
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

// What a word may look like in each language: English exactly as it always
// was (plain a–z, an apostrophe inside a fix); other Latin languages with
// their accented letters; Arabic script with its marks and the ZWNJ.
interface Shape {
  lower: RegExp
  fix: RegExp
  capital: RegExp
}
const SHAPES: Record<'en' | 'latin' | 'arabic', Shape> = {
  en: { lower: /^[a-z]+$/, fix: /^[A-Za-z]+(?:'[A-Za-z]+)?$/, capital: /^[A-Z][a-z]+$/ },
  latin: { lower: /^\p{Ll}+$/u, fix: /^[\p{L}]+(?:['’-][\p{L}]+)*$/u, capital: /^\p{Lu}\p{Ll}+$/u },
  arabic: { lower: /^[\p{Script=Arabic}\p{M}\u200c]+$/u, fix: /^[\p{Script=Arabic}\p{M}\u200c]+$/u, capital: /(?!)/ },
}
const shapeOf = (lang: SpellLanguage) => (lang.code === 'en' ? SHAPES.en : SHAPES[lang.script])

export function suggestionsFor(spell: Speller, word: string, lang: SpellLanguage = ENGLISH): Suggestion | null {
  let known = memo.get(spell)
  if (!known) memo.set(spell, (known = new Map()))
  if (known.has(word)) return known.get(word)!
  const found = rank(spell, word, lang)
  known.set(word, found)
  return found
}

// The best fix alone (tests, and anything that needs one word).
export const fixFor = (spell: Speller, word: string, lang: SpellLanguage = ENGLISH) => suggestionsFor(spell, word, lang)?.fixes[0] ?? null

function rank(spell: Speller, word: string, lang: SpellLanguage): Suggestion | null {
  const shape = shapeOf(lang)
  if ([...word].length < 3 || !shape.lower.test(word) || (lang.code === 'en' && NEVER.has(word)) || spell.correct(word)) return null
  // How common a word is counts for English only (the one frequency list).
  const rare = lang.code === 'en' ? rarity : () => 0
  // Outside English, a word typed in small letters isn't offered in capitals (Strasse → STRASSE).
  const candidates = [...new Set(spell.suggest(word))].filter((s) => s !== word && shape.fix.test(s) && (lang.code === 'en' || [...s].length < 2 || s !== s.toUpperCase() || s === s.toLowerCase()))
  const scored = candidates
    .map((s, i) => ({ s, edit: slipCost(word, s, lang), i }))
    .filter((c) => c.edit <= MAX_COST)
    .map((c) => ({ s: c.s, score: c.edit + rare(c.s) + c.i * 0.001 }))
    .sort((x, y) => x.score - y.score)
  if (!scored.length) return null
  const best = scored[0]
  // Never sure in Farsi (owner, 2026-11-21, open decision #32): the dictionary
  // is formal Persian, so spoken forms (میخوام) look like typos; a click can
  // still fix one, but "fix all" leaves them alone.
  const sure = lang.code !== 'fa' && slipCost(word, best.s, lang) <= SURE_COST && (scored.length === 1 || scored[1].score - best.score >= SURE_GAP)
  return { fixes: scored.slice(0, SHOWN).map((c) => c.s), sure }
}

// A capitalised word is checked only where a sentence starts (a line's
// start, after a list or heading marker, or after . ! ?); anywhere else
// it's most likely a name. The fixes keep the capital.
const SENTENCE_START = /(^|[.!?]["')\]]?\s+|^\s*(#{1,6}|[-*+>]|[\d\u06F0-\u06F9\u0660-\u0669]+[.)])\s+)$/

export function suggestionFor(spell: Speller, word: string, before: string, lang: SpellLanguage = ENGLISH): Suggestion | null {
  const shape = shapeOf(lang)
  if (shape.lower.test(word)) return suggestionsFor(spell, word, lang)
  if (!shape.capital.test(word) || !SENTENCE_START.test(before) || spell.correct(word)) return null
  const found = suggestionsFor(spell, word.toLowerCase(), lang)
  if (!found) return null
  // "Tuesday" checked as "tuesday" comes back as itself: not a typo.
  const fixes = [...new Set(found.fixes.map((f) => f[0].toUpperCase() + f.slice(1)))].filter((f) => f !== word)
  return fixes.length ? { fixes, sure: found.sure && fixes.length === found.fixes.length } : null
}
