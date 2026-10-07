import type { Prose, Sentence } from '../text'

// Farsi text basics for the Farsi Pass A (ruleset/fa/checks.md, "Shared
// definitions"). JavaScript's \b doesn't see Arabic-script letters and the
// half-space (ZWNJ) isn't a letter, so every Farsi pattern builds its word
// boundaries from these.

export const Z = '‌' // ZWNJ, the half-space
export const L = 'ء-غف-يٱ-ۓە' // Arabic-script letters (Persian and Arabic)
export const M = 'ً-ٰٟ' // diacritics, including U+0654 (the ezafe hamza)
export const W = `${L}${M}${Z}` // what can sit inside a Farsi word
export const WB = `(?<![${W}])` // start of a Farsi word
export const WE = `(?![${W}])` // end of a Farsi word

export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Arabic ي ى ك → Persian ی ی ک, one character for one, so offsets stay
// valid. Table lookups match against this copy.
export const normalise = (s: string) => s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')

// A word runs on through vowel marks and the half-space: می‌روم is one word.
const WORD_FA = /[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}'’_-]|‌)*/gu
export const countWordsFa = (s: string) => (s.match(WORD_FA) ?? []).length
const FA_LETTER = new RegExp(`^[${L}]`, 'u')
export const farsiWordCount = (s: string) => (s.match(WORD_FA) ?? []).filter((w) => FA_LETTER.test(w)).length
// A Farsi sentence has two or more Farsi words; English terms, code and URLs
// inside it don't change that.
export const isFarsiText = (s: string) => farsiWordCount(s) >= 2

// An entry's spaces and half-spaces are interchangeable when matching.
export const entryPattern = (entry: string) =>
  entry
    .split(/([ ‌])/)
    .map((part) => (part === ' ' ? '[ \\u200c]' : part === Z ? '[ \\u200c]?' : esc(part)))
    .join('')

// ---- sentences ----

const SENT_END = /[.!?؟…]+["»”')\]]*(?=\s|$)/gu

// Farsi sentences over the prose blocks Pass A already found: ends at
// . ! ? ؟ …, never at a decimal point between digits (Latin or Persian).
export function farsiSentences(prose: Prose): Sentence[] {
  const out: Sentence[] = []
  for (const block of prose.blocks) {
    const text = prose.masked.slice(block.from, block.to)
    let start = 0
    SENT_END.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = SENT_END.exec(text))) {
      const end = m.index + m[0].length
      if (/[0-9۰-۹]$/.test(text.slice(0, m.index)) && /^[0-9۰-۹]/.test(text.slice(end))) continue
      push(start, end)
      start = end
    }
    push(start, text.length)
    function push(a: number, b: number) {
      const part = text.slice(a, b)
      const lead = part.search(/\S/)
      if (lead === -1) return
      const from = block.from + a + lead
      const to = block.from + a + part.trimEnd().length
      const words = countWordsFa(prose.masked.slice(from, to))
      if (words > 0) out.push({ from, to, words, block })
    }
  }
  return out
}

// ---- units: quotes are their own unit ----

const QUOTED = /«[^»\n]*»|"[^"\n]*"|“[^”\n]*”/g

// The stretch a position's language is judged by: the quotation it sits in,
// or else its sentence.
export function unitAt(text: string, sentence: { from: number; to: number }, pos: number): { from: number; to: number } {
  const s = text.slice(sentence.from, sentence.to)
  for (const q of s.matchAll(QUOTED)) {
    const from = sentence.from + q.index
    const to = from + q[0].length
    if (pos > from && pos < to - 1) return { from: from + 1, to: to - 1 }
  }
  return sentence
}

// Quoted Arabic must never be "corrected" into Persian.
const ARABIC_MARKER = /[ً-ْ]|ة|(?<![ء-ي])ال[ء-ي]{2,}/u
const PERSIAN_SIGNAL = new RegExp(`[پچژگکی]|${WB}(?:را|است|این|که|می)${WE}`, 'u')
export const isArabicText = (s: string) => ARABIC_MARKER.test(s) && !PERSIAN_SIGNAL.test(s)
