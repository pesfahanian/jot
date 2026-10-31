import type NSpell from 'nspell'

// Auto-fix spelling (Phase 16; research in docs/research/phase-16-2026-10.md):
// a merged en_US + en_GB Hunspell dictionary (public/dict/, built by
// scripts/build-dictionary.mjs), loaded only when auto-fix is on. A page
// can't read the browser's own spellchecker, so Jot carries one.
//
// The rule fixes only what's unambiguous: a lowercase word of 3+ letters,
// unknown to the dictionary, where swapping one pair of neighbouring
// letters makes exactly one real word ("teh" → "the"), or else the
// dictionary offers exactly one suggestion ("definately" → "definitely").
// It never touches a real word, so "form" for "from" is left alone — the
// price of never changing a correct word.

// Typos whose single fix is wrong ("alot" is two words, not "alto").
const NEVER = new Set(['alot'])

let speller: Promise<NSpell> | null = null

export function loadSpeller(): Promise<NSpell> {
  speller ??= Promise.all([import('nspell'), fetch('/dict/en.aff').then((r) => r.text()), fetch('/dict/en.dic').then((r) => r.text())]).then(([{ default: nspell }, aff, dic]) => nspell(aff, dic))
  speller.catch(() => (speller = null))
  return speller
}

export function fixFor(spell: Pick<NSpell, 'correct' | 'suggest'>, word: string): string | null {
  if (word.length < 3 || !/^[a-z]+$/.test(word) || NEVER.has(word) || spell.correct(word)) return null
  const swaps = new Set<string>()
  for (let i = 0; i + 1 < word.length; i++) {
    const s = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
    if (s !== word && spell.correct(s)) swaps.add(s)
  }
  if (swaps.size === 1) return [...swaps][0]
  if (swaps.size > 1) return null
  const suggestions = spell.suggest(word)
  return suggestions.length === 1 && /^[a-z]+$/.test(suggestions[0]) ? suggestions[0] : null
}
