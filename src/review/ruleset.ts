// T5.8 — the Style Review rule set, bundled at build time as static strings.
// No runtime fetch, no backend: these are the exact files in ./ruleset.
import bannedVocabularyMd from './ruleset/banned-vocabulary.md?raw'
import checksMd from './ruleset/checks.md?raw'
import tier1ExamplesMd from './ruleset/examples/tier1-examples.md?raw'
import tier2ExamplesMd from './ruleset/examples/tier2-examples.md?raw'
import modesMd from './ruleset/modes.md?raw'
import outputSchemaMd from './ruleset/output-schema.md?raw'
import readmeMd from './ruleset/README.md?raw'
import rulesMd from './ruleset/RULES.md?raw'

export const ruleset = {
  readme: readmeMd,
  rules: rulesMd,
  checks: checksMd,
  modes: modesMd,
  bannedVocabulary: bannedVocabularyMd,
  outputSchema: outputSchemaMd,
  tier1Examples: tier1ExamplesMd,
  tier2Examples: tier2ExamplesMd,
} as const

// The ruleset has no product name; its README titles it "Style Guide" and the
// newest revision note is Rev 5.
export const RULESET_NAME = 'style-guide'
export const RULESET_VERSION = `rev ${Math.max(...[...readmeMd.matchAll(/^Rev (\d+):/gm)].map((m) => Number(m[1])), 0)}`

// ── banned-vocabulary.md, parsed ────────────────────────────────────────────
// The client-side (mechanical) fixes read the same file the model sees, so a
// table edit changes both.

function tableUnder(heading: string): string[][] {
  const at = bannedVocabularyMd.indexOf(`## ${heading}`)
  if (at === -1) return []
  const next = bannedVocabularyMd.indexOf('\n## ', at + 3)
  const block = bannedVocabularyMd.slice(at, next === -1 ? undefined : next)
  return block
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
    .slice(1) // header row
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
}

export type VocabFix =
  // A plain replacement word ("utilize" → "use").
  | { type: 'replace'; word: string }
  // The table says to cut the word ("(cut)", "(usually cut entirely)").
  | { type: 'cut' }
  // The table gives guidance, not a word ("(state the failure mode it
  // survives)") — the rewrite is generative, so it rides the shared call.
  | { type: 'generative'; guidance: string }

export interface VocabEntry {
  banned: string
  fix: VocabFix
}

function parseFix(cell: string): VocabFix {
  const paren = cell.match(/^\((.*)\)$/)
  if (paren) {
    const inner = paren[1]
    return /^(usually )?cut\b/i.test(inner) && !/,\s*or\b/i.test(inner) ? { type: 'cut' } : { type: 'generative', guidance: inner }
  }
  return { type: 'replace', word: cell.split('/')[0].trim() }
}

export const bannedWords: VocabEntry[] = [
  ...tableUnder('AI-tell vocabulary → plain replacement'),
  ...tableUnder('Marketing adjectives → cut or replace with a fact'),
  ...tableUnder('Inflated verbs → plain verb'),
].map(([banned, fix]) => ({ banned: banned.toLowerCase(), fix: parseFix(fix) }))

export interface PhrasalEntry {
  verb: string
  particle: string
  replacement: string
  // "take off (a part)": only the transitive sense is banned — a plane still
  // takes off.
  needsObject: boolean
}

export const phrasalVerbs: PhrasalEntry[] = tableUnder('Phrasal verbs → single verb').map(([banned, repl]) => {
  const needsObject = /\(.*\)/.test(banned)
  const [verb, particle] = banned.replace(/\(.*\)/, '').trim().split(/\s+/)
  return { verb: verb.toLowerCase(), particle: particle.toLowerCase(), replacement: repl.split('/')[0].trim(), needsObject }
})

export const firstWordFingerprints: string[] = (() => {
  const at = bannedVocabularyMd.indexOf('## First-word fingerprints')
  const line = bannedVocabularyMd.slice(at).split('\n').find((l, i) => i > 0 && l.trim().length > 0) ?? ''
  return line
    .split(' / ')
    .map((p) => p.replace(/\.\.\.$/, '').trim())
    .filter(Boolean)
})()

export interface NominalizationEntry {
  lightVerbs: string[]
  determiner: string | null
  noun: string
  verb: string
}

export const nominalizations: NominalizationEntry[] = tableUnder('Nominalization → verb form (T1b-03)').map(([phrase, verb]) => {
  const words = phrase.split(/\s+/)
  const noun = words[words.length - 1]
  const det = words.length >= 3 && /^(a|an|the)$/i.test(words[words.length - 2]) ? words[words.length - 2].toLowerCase() : null
  const verbPart = words.slice(0, det ? -2 : -1).join(' ')
  return {
    lightVerbs: verbPart.split('/').map((v) => v.trim().toLowerCase()),
    determiner: det,
    noun: noun.toLowerCase(),
    verb: verb.split('/')[0].trim(),
  }
})

