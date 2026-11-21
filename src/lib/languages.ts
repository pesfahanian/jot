// The languages Jot spell-checks (owner, 2026-11-21): English, built in,
// and downloadable packs: Farsi, Arabic, French, Spanish, German, Dutch
// (Hebrew dropped, open decision #28). Each word is checked in the language
// of its script: Latin words in the document's Latin language (a default
// in settings, changeable per document), Arabic-script words in Farsi or
// Arabic — Farsi when both are installed, unless the document says Arabic.

export type Script = 'latin' | 'arabic'

export interface SpellLanguage {
  code: string
  name: string
  script: Script
  // Keyboard rows, for "a neighbouring key" in the ranking (lib/spelling.ts).
  rows: string[]
  // The dictionary's licence, as shipped beside the pack.
  licence: string
}

export const ENGLISH: SpellLanguage = { code: 'en', name: 'english', script: 'latin', rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'], licence: 'en_US / en_GB (SCOWL): BSD-style and LGPL' }

// The packs, in the order settings lists them.
export const PACKS: SpellLanguage[] = [
  { code: 'fa', name: 'farsi', script: 'arabic', rows: ['ضصثقفغعهخحجچ', 'شسیبلاتنمکگ', 'ظطزرذدپو'], licence: 'Lilak: Apache-2.0' },
  { code: 'ar', name: 'arabic', script: 'arabic', rows: ['ضصثقفغعهخحجد', 'شسيبلاتنمكط', 'ئءؤرىةوزظ'], licence: 'Ayaspell: GPL-2.0 / LGPL-2.1 / MPL-1.1' },
  { code: 'fr', name: 'french', script: 'latin', rows: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'], licence: 'Dicollecte: MPL-2.0' },
  { code: 'es', name: 'spanish', script: 'latin', rows: ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'], licence: 'RLA-ES: GPL-3.0 / LGPL-3.0 / MPL-1.1' },
  { code: 'de', name: 'german', script: 'latin', rows: ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm'], licence: 'igerman98: GPL-2.0 / GPL-3.0' },
  { code: 'nl', name: 'dutch', script: 'latin', rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'], licence: 'OpenTaal: BSD-3-Clause / CC-BY-3.0' },
]

export const LANGUAGE = new Map([ENGLISH, ...PACKS].map((l) => [l.code, l]))

// The script a word is written in, or null for one Jot doesn't check.
export function scriptOf(word: string): Script | null {
  const c = word.codePointAt(0) ?? 0
  if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) return 'latin'
  if (c >= 0x600 && c <= 0x6ff) return 'arabic'
  return null
}

// Which installed language checks a script in a document. `doc` is the
// document's own choice (latin: a Latin language; arabic: fa or ar).
export function languageFor(script: Script, installed: ReadonlySet<string>, latinDefault: string, doc?: { latin?: string; arabic?: string }): string | null {
  if (script === 'latin') {
    const want = doc?.latin ?? latinDefault
    return want === 'en' || installed.has(want) ? want : 'en'
  }
  if (doc?.arabic && installed.has(doc.arabic)) return doc.arabic
  if (installed.has('fa')) return 'fa'
  if (installed.has('ar')) return 'ar'
  return null
}
