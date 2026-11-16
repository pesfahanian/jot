import type NSpell from 'nspell'

// Spelling suggestions (Phase 16, made suggestions on 2026-11-15; research
// in docs/research/phase-16-2026-10.md): a merged en_US + en_GB Hunspell
// dictionary (public/dict/, built by scripts/build-dictionary.mjs), loaded
// only when the setting is on. A page can't read the browser's own
// spellchecker, so Jot carries one. Nothing changes until the person clicks
// a suggestion (editor/spelling.ts).
//
// The rule fixes only what's unambiguous: a lowercase word of 3+ letters,
// unknown to the dictionary, where swapping one pair of neighbouring
// letters makes exactly one real word ("teh" → "the"), or else the
// dictionary offers exactly one suggestion ("definately" → "definitely"),
// or the word only lacks its capital ("october" → "October").
// It never marks a real word, so "form" for "from" is left alone — the
// price of never suggesting a change to a correct word.

// Typos whose single fix is wrong ("alot" is two words, not "alto").
const NEVER = new Set(['alot'])

let speller: Promise<NSpell> | null = null

export function loadSpeller(): Promise<NSpell> {
  speller ??= Promise.all([import('nspell'), fetch('/dict/en.aff').then((r) => r.text()), fetch('/dict/en.dic').then((r) => r.text())]).then(([{ default: nspell }, aff, dic]) => nspell(aff, dic))
  speller.catch(() => (speller = null))
  return speller
}

// Each word is looked up once per dictionary: suggest() is slow, and a
// document repeats its words.
const memo = new WeakMap<object, Map<string, string | null>>()

export function fixFor(spell: Pick<NSpell, 'correct' | 'suggest'>, word: string): string | null {
  let known = memo.get(spell)
  if (!known) memo.set(spell, (known = new Map()))
  if (known.has(word)) return known.get(word)!
  const fix = lookUp(spell, word)
  known.set(word, fix)
  return fix
}

function lookUp(spell: Pick<NSpell, 'correct' | 'suggest'>, word: string): string | null {
  if (word.length < 3 || !/^[a-z]+$/.test(word) || NEVER.has(word) || spell.correct(word)) return null
  const swaps = new Set<string>()
  for (let i = 0; i + 1 < word.length; i++) {
    const s = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
    if (s !== word && spell.correct(s)) swaps.add(s)
  }
  if (swaps.size === 1) return [...swaps][0]
  if (swaps.size > 1) return null
  const suggestions = spell.suggest(word)
  // A name or a day, month or language written in lowercase ("october"):
  // the same word with its capital is never a guess.
  const capital = suggestions.find((s) => s !== word && s.toLowerCase() === word)
  if (capital) return capital
  return suggestions.length === 1 && /^[a-z]+$/.test(suggestions[0]) ? suggestions[0] : null
}

// A capitalised word is checked only where a sentence starts (a line's
// start, after a list or heading marker, or after . ! ?); anywhere else
// it's most likely a name. The fix keeps the capital.
const SENTENCE_START = /(^|[.!?]["')\]]?\s+|^\s*(#{1,6}|[-*+>]|\d+[.)])\s+)$/

export function suggestionFor(spell: Pick<NSpell, 'correct' | 'suggest'>, word: string, before: string): string | null {
  if (/^[a-z]+$/.test(word)) return fixFor(spell, word)
  if (!/^[A-Z][a-z]+$/.test(word) || !SENTENCE_START.test(before) || spell.correct(word)) return null
  const fix = fixFor(spell, word.toLowerCase())
  const capital = fix && fix[0].toUpperCase() + fix.slice(1)
  // "Tuesday" checked as "tuesday" comes back as itself: not a typo.
  return capital && capital !== word ? capital : null
}
