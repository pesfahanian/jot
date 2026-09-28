import type { ReviewFlag } from '@/lib/db'
import { isNote, isProofing } from './model'

// What the reader sees instead of the rule set's internals (owner, testing):
// every flag is one of seven kinds, named for what it asks of the reader,
// each with one color. Tiers stay the rule set's own vocabulary; the UI
// never shows them.
//   quick      Tier 1 — a clear rule broke, the fix is ready
//   check      Tier 1b with a fix — right fix depends on context
//   call       Tier 2, and any flag with no fix (e.g. T1b-04) — reader decides
//   spelling / grammar / punctuation — objective proofing errors
//   note       the reviewer quoted text that isn't in the document
export type Kind = 'quick' | 'check' | 'call' | 'spelling' | 'grammar' | 'punctuation' | 'note'

export const KIND_ORDER: Kind[] = ['quick', 'check', 'call', 'spelling', 'grammar', 'punctuation', 'note']

export interface KindInfo {
  name: string
  // One line, for hovers and the help panel.
  help: string
  // Line color, and (tiers only) the wash behind text.
  ink: string
  ground?: string
  // How the legend draws its sample: a filled square, a squiggle, or a
  // hollow square (no color).
  mark: 'wash' | 'squiggle' | 'none'
}

export const KINDS: Record<Kind, KindInfo> = {
  quick: {
    name: 'Quick fix',
    help: 'A clear rule was broken, and the fix is ready. Usually safe to accept.',
    ink: 'var(--flag-quick)',
    ground: 'var(--flag-quick-bg)',
    mark: 'wash',
  },
  check: {
    name: 'Check fix',
    help: 'A fix is ready, but the right one depends on context. Read it before accepting.',
    ink: 'var(--flag-check)',
    ground: 'var(--flag-check-bg)',
    mark: 'wash',
  },
  call: {
    name: 'Your call',
    help: 'A pattern worth a second look. There is no fix — rewrite it yourself or dismiss it.',
    ink: 'var(--flag-call)',
    ground: 'var(--flag-call-bg)',
    mark: 'wash',
  },
  spelling: { name: 'Spelling', help: 'A misspelled word.', ink: 'var(--proof-spelling)', mark: 'squiggle' },
  grammar: { name: 'Grammar', help: 'A grammar mistake.', ink: 'var(--proof-grammar)', mark: 'squiggle' },
  punctuation: { name: 'Punctuation', help: 'A punctuation mistake.', ink: 'var(--proof-punct)', mark: 'squiggle' },
  note: {
    name: 'Note',
    help: 'The reviewer mentioned text it could not find in your document. Just dismiss it.',
    ink: 'var(--ink-dim)',
    mark: 'none',
  },
}

export function kindOf(f: ReviewFlag): Kind {
  if (isNote(f)) return 'note'
  if (isProofing(f.family)) return f.family as Kind
  if (f.family === 'tier2' || f.kind === 'flag') return 'call'
  return f.family === 'tier1b' ? 'check' : 'quick'
}

export const kindInfo = (f: ReviewFlag) => KINDS[kindOf(f)]

// Flags per kind, in legend order, leaving out kinds with none.
export function kindCounts(flags: ReviewFlag[]): { kind: Kind; total: number; pending: number }[] {
  return KIND_ORDER.map((kind) => {
    const of = flags.filter((f) => kindOf(f) === kind)
    return { kind, total: of.length, pending: of.filter((f) => f.status === 'pending').length }
  }).filter((k) => k.total > 0)
}

// Plain names for the rules, shown under a flag's kind (RULES.md's own
// titles are written for the rule set's authors). Rule ids stay internal.
const RULE_NAMES: Record<string, string> = {
  'T1-01': '"Not X, but Y" contrast',
  'T1-02': 'Overused word',
  'T1-03': 'Stock transition',
  'T1-04': 'Markdown inside prose',
  'T1-05': '"From X to Y" phrasing',
  'T1-06': 'Stock opener',
  'T1-07': 'Stacked hedging',
  'T1-08': 'Sentence too long',
  'T1-09': 'Sentences all one length',
  'T1-10': 'List items all one length',
  'T1-11': '"Despite X, Y" upbeat turn',
  'T1-12': 'Phrasal verb',
  'T1b-01': 'One thing, several names',
  'T1b-02': 'Synonym swapping',
  'T1b-03': 'Noun where a verb works',
  'T1b-04': 'Vague attribution',
  'T1b-05': 'Em dash',
  'T1b-06': 'Semicolon',
  'T2-01': 'Too abstract',
  'T2-02': 'Padding',
  'T2-03': 'Hedging both ways',
  'T2-04': 'Abstraction acting like a person',
  'T2-05': 'Over-explaining',
  'T2-06': 'Commentary about the text',
  'T2-07': 'Decorative list of three',
  'T2-08': 'Tacked-on clause',
}

// The rule's plain name, or null for proofing and notes (their kind says it all).
export function ruleName(f: ReviewFlag): string | null {
  const k = kindOf(f)
  if (k !== 'quick' && k !== 'check' && k !== 'call') return null
  return RULE_NAMES[f.id] ?? null
}
