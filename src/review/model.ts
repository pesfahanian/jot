import type { FlagFamily, FlagStatus, ReviewFlag } from '@/lib/db'

// The review state machine (ADR-009, interaction spec §7). Pure functions
// over the flag list — the one part of the app T6.2 unit-tests.
//
// Nothing auto-applies: every flag needs an explicit terminal decision
// before it counts as decided, and the document changes only when the
// fully decided set is applied.

export type Decision = 'accept' | 'reject' | 'ignore' | 'dismiss' | 'edit'

export const isNote = (f: ReviewFlag) => f.spanStart === null || f.spanEnd === null
export const isProofing = (family: FlagFamily) => family === 'spelling' || family === 'grammar' || family === 'punctuation'

// Which terminal actions each kind of flag offers (spec §2).
export function allowedDecisions(f: ReviewFlag): Decision[] {
  if (isNote(f)) return ['dismiss']
  if (isProofing(f.family)) return ['accept', 'ignore']
  if (f.family === 'tier2' || f.kind === 'flag') return ['edit', 'dismiss']
  if (f.family === 'tier1b') return ['accept', 'reject', 'edit']
  return ['accept', 'reject']
}

const statusFor: Record<Decision, FlagStatus> = {
  accept: 'accepted',
  reject: 'rejected',
  ignore: 'ignored',
  dismiss: 'dismissed',
  edit: 'edited',
}

// Records a decision. Decisions stay revisable until apply; an action the
// flag doesn't offer is refused (returns the list unchanged).
export function decide(flags: ReviewFlag[], key: string, decision: Decision, userText?: string): ReviewFlag[] {
  return flags.map((f) => {
    if (f.key !== key || !allowedDecisions(f).includes(decision)) return f
    if (decision === 'edit') {
      if (userText === undefined) return f
      return { ...f, status: 'edited', userText }
    }
    const next: ReviewFlag = { ...f, status: statusFor[decision] }
    delete next.userText
    return next
  })
}

// Back to pending (a decision can be reopened before apply).
export function reopen(flags: ReviewFlag[], key: string): ReviewFlag[] {
  return flags.map((f) => {
    if (f.key !== key) return f
    const next: ReviewFlag = { ...f, status: 'pending' }
    delete next.userText
    return next
  })
}

export const isDecided = (f: ReviewFlag) => f.status !== 'pending'

export function counts(flags: ReviewFlag[]) {
  const decided = flags.filter(isDecided).length
  return { proposed: flags.length, decided, pending: flags.length - decided }
}

// Apply is a precondition, not a UI inference: enabled only when every
// flag has reached a terminal state.
export const canApply = (flags: ReviewFlag[]) => flags.every(isDecided)

// The text a flag puts in its span, or null for "leave the original".
//  final   — only accepted / edited flags change the document
//  preview — pending flags also show their tier default (spec §1): Tier 1,
//            Tier 1b and proofing preview the fix; Tier 2 has none to show
export function replacementFor(f: ReviewFlag, mode: 'preview' | 'final'): string | null {
  if (isNote(f)) return null
  switch (f.status) {
    case 'accepted':
      return f.after
    case 'edited':
      return f.userText ?? null
    case 'pending':
      return mode === 'preview' && f.family !== 'tier2' ? f.after : null
    default:
      return null
  }
}

export interface Applied {
  flag: ReviewFlag
  start: number
  end: number
  text: string
}

// Flags whose spans overlap can't both apply. The wider span wins (its
// rewrite was written from the whole original stretch); a narrower flag
// inside an applied one is superseded for that stretch but still needs its
// own decision (open-decisions #16). Greedy: longest span first, then
// earliest.
export function appliedSet(flags: ReviewFlag[], mode: 'preview' | 'final'): Applied[] {
  const cands: Applied[] = []
  for (const f of flags) {
    const text = replacementFor(f, mode)
    if (text === null || isNote(f)) continue
    cands.push({ flag: f, start: f.spanStart!, end: f.spanEnd!, text })
  }
  cands.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start)
  const chosen: Applied[] = []
  for (const c of cands) {
    if (chosen.some((x) => c.start < x.end && x.start < c.end)) continue
    chosen.push(c)
  }
  return chosen.sort((a, b) => a.start - b.start)
}

export interface Segment {
  text: string
  // The flag whose replacement produced this text, if any.
  flag?: ReviewFlag
  // Where this segment sits in the source.
  sourceStart: number
  sourceEnd: number
}

// The source with a set of replacements applied, as segments the preview
// pane renders (each changed run knows its flag).
export function compose(source: string, applied: Applied[]): Segment[] {
  const out: Segment[] = []
  let at = 0
  for (const a of applied) {
    if (a.start > at) out.push({ text: source.slice(at, a.start), sourceStart: at, sourceEnd: a.start })
    out.push({ text: a.text, flag: a.flag, sourceStart: a.start, sourceEnd: a.end })
    at = a.end
  }
  if (at < source.length) out.push({ text: source.slice(at), sourceStart: at, sourceEnd: source.length })
  return out
}

export const composeText = (source: string, applied: Applied[]) =>
  compose(source, applied)
    .map((s) => s.text)
    .join('')

// What Apply writes: the final applied set as a positional patch list, and
// the counts the toast reports — "changes" excludes decisions that change
// nothing (rejections, ignores, dismissals, and no-op edits).
export function applyPlan(source: string, flags: ReviewFlag[]) {
  const applied = appliedSet(flags, 'final').filter((a) => a.text !== source.slice(a.start, a.end))
  return {
    changes: applied.map((a) => ({ from: a.start, to: a.end, insert: a.text })),
    changed: applied.length,
    kept: flags.length - applied.length,
    text: composeText(source, applied),
  }
}

// Left-pane / log description of a flag's change (spec §8).
export function describe(f: ReviewFlag): string {
  if (isNote(f)) return `"${f.before}" — quoted text not found in the document`
  if (f.family === 'tier2' || f.after === null) return `"${f.before}"`
  if (f.status === 'edited') return `${f.before} → ${f.userText ?? ''}`
  return `${f.before} → ${f.after === '' ? '(deleted)' : f.after}`
}
