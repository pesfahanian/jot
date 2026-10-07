import vocabularyMd from '../ruleset/fa/banned-vocabulary.md?raw'
import { WB, WE, Z, entryPattern, esc } from './text'

// The Farsi word tables (ruleset/fa/banned-vocabulary.md), parsed, and the
// verb generator (checks.md, "Verb forms") they lean on. The file is
// client-side data: the model never sees it.

function section(heading: string): string {
  const at = vocabularyMd.indexOf(`## ${heading}`)
  if (at === -1) return ''
  const next = vocabularyMd.indexOf('\n## ', at + 3)
  return vocabularyMd.slice(at, next === -1 ? undefined : next)
}

// A markdown table under a heading, header row dropped.
export function tableUnder(heading: string): string[][] {
  return section(heading)
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
    .slice(1)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
}

// A one-line list under a heading: entries split on " / ", a trailing "..."
// dropped.
export function listUnder(heading: string): string[] {
  const line = section(heading)
    .split('\n')
    .slice(1)
    .find((l) => l.includes(' / '))
  return line ? line.split(' / ').map((e) => e.trim().replace(/\.\.\.$/, '').replace(/…$/, '')) : []
}

export type Fix = { type: 'replace'; word: string } | { type: 'cut' } | { type: 'guidance'; text: string }

// "(cut)" cuts; any other parenthetical is guidance for the shared call;
// anything else is the replacement.
export function parseFix(cell: string): Fix {
  const paren = cell.match(/^\((.*)\)$/)
  if (!paren) return { type: 'replace', word: cell }
  return /^cut$/i.test(paren[1].trim()) ? { type: 'cut' } : { type: 'guidance', text: paren[1] }
}

// ---- verbs ----

export interface Verb {
  infinitive: string
  present: string
  past: string
}
export const verbs = new Map<string, Verb>(tableUnder('Verb stems (FA-T1-01, FA-T1-15, FA-T1b-05)').map(([infinitive, present, past]) => [infinitive, { infinitive, present, past }]))

const P = ['م', 'ی', 'د', 'یم', 'ید', 'ند']
const Q = ['م', 'ی', '', 'یم', 'ید', 'ند']
const C = ['ام', 'ای', 'است', 'ایم', 'اید', 'اند']

// Every form the rules need, keyed by tense, person and negation, so a
// replacement verb can be put in exactly the same form.
export interface VerbForm {
  text: string
  key: string
}
export function verbForms(infinitive: string): VerbForm[] {
  const v = verbs.get(infinitive)
  if (!v) return []
  const out: VerbForm[] = []
  for (const neg of ['', 'ن']) {
    for (let p = 0; p < 6; p++) {
      out.push({ text: `${neg}${v.past}${Q[p]}`, key: `past${neg}${p}` })
      out.push({ text: `${neg}می${Z}${v.past}${Q[p]}`, key: `imperfect${neg}${p}` })
      out.push({ text: `${neg}می${Z}${v.present}${P[p]}`, key: `present${neg}${p}` })
      out.push({ text: `${neg || 'ب'}${v.present}${P[p]}`, key: `subjunctive${neg}${p}` })
      out.push({ text: `${neg}${v.past}ه${Z}${C[p]}`, key: `perfect${neg}${p}` })
      out.push({ text: `${neg}${v.past}ه ${C[p]}`, key: `perfect${neg}${p}` })
      out.push({ text: `${neg}خواه${P[p]} ${v.past}`, key: `future${neg}${p}` })
    }
    out.push({ text: `${neg || 'ب'}${v.present}`, key: `imperative${neg}0` })
    out.push({ text: `${neg || 'ب'}${v.present}ید`, key: `imperative${neg}1` })
  }
  out.push({ text: `${v.past}ه`, key: 'participle' })
  return out
}

// The same form of another verb (the replacement), written standard: the
// half-space after می and before a perfect ending.
export function conjugate(infinitive: string, key: string): string | null {
  const form = verbForms(infinitive).find((f) => f.key === key)
  return form ? form.text : null
}

// A pattern matching any form of a verb — with a half-space, a space or no
// gap where the standard has a half-space — capturing the matched form.
export function verbPattern(infinitive: string): { re: string; keyOf: (s: string) => string | null } {
  const forms = verbForms(infinitive)
  const loose = (t: string) => t.split(Z).map(esc).join('[ \\u200c]?')
  const alts = [...new Set(forms.map((f) => loose(f.text)))].sort((a, b) => b.length - a.length)
  const re = `${WB}(?:${alts.join('|')})${WE}`
  const keyOf = (s: string) => {
    const want = s.replace(/[ ‌]/g, '')
    return forms.find((f) => f.text.replace(/[ ‌]/g, '') === want)?.key ?? null
  }
  return { re, keyOf }
}

// ---- the tables ----

const entries = (heading: string) => tableUnder(heading).map(([banned, fix]) => ({ banned, fix: parseFix(fix), re: `${WB}${entryPattern(banned)}${WE}` }))

export const aiTell = entries('AI-tell vocabulary → plain replacement')
export const marketing = entries('Marketing adjectives → cut or replace with a fact')
export const inflatedVerbs = tableUnder('Inflated verbs → plain verb').map(([banned, plain]) => ({ banned, plain }))
export const officialeseBe = entries('Officialese "to be" → plain form')
export const stiffConnectors = tableUnder('Stiff connectors → plain word (FA-T1b-04)').map(([stiff, plain, guard]) => ({ stiff, plain, guard, re: `${WB}${entryPattern(stiff)}${WE}` }))
export const openers = listUnder('First-word fingerprints (banned at section starts)')
export const transitions = listUnder('Stock transitions (FA-T1-16)')
export const doublets = tableUnder('Synonym doublets → single word (FA-T1b-06)').map(([pair, single]) => ({ pair, single, re: `${WB}${entryPattern(pair)}${WE}` }))
export const lightVerbRows = tableUnder('Light-verb padding → verb form (FA-T1b-05)').map(([padded, plain]) => ({ padded, plain }))
export const eligibleNouns = listUnder('Nouns eligible for «مورد N قرار …» (FA-T1b-05)')
export const loanwords = tableUnder('Loanwords with an approved equivalent (FA-T1b-07)').map(([word, equivalent]) => ({ word, equivalent }))
export const slips = tableUnder('Orthography slips → standard form (FA-T1-14)').map(([wrong, standard]) => ({ wrong, standard, re: `${WB}${entryPattern(wrong)}${WE}` }))
export const joinedComparatives = new Set(tableUnder('Comparatives always written joined (FA-T1-03, FA-T1b-01)').map(([stem]) => stem))
export const wetWords = new Set(listUnder('Words that take a separate «تر» (wet), not the comparative (FA-T1b-01)'))
