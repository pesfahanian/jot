import type { FlagKind, ReviewFlag } from '@/lib/db'
import { anchorQuote, type Range } from './anchor'
import type { PassAResult, RawFlag } from './passA'
import type { SharedResponse } from './sharedCall'

// T5.12 — combine Pass A's mode-independent flags, Pass A's generative
// fixes, Pass B's reconciled flags and the shared call's own flags into one
// list, and map every record onto Jot's ReviewFlag. Aggregate rules stay as
// one independent record per contributing instance — never collapsed.

// after → kind (addendum): null → flag (no fix, by design); "" → delete
// (handled defensively, no current rule emits it); anything else → replace.
export function kindFor(after: string | null): FlagKind {
  if (after === null) return 'flag'
  return after === '' ? 'delete' : 'replace'
}

let keySeq = 0
const newKey = () => `${Date.now().toString(36)}-${(keySeq++).toString(36)}`

export function toReviewFlag(raw: RawFlag, range: Range | null, text: string): ReviewFlag {
  return {
    key: newKey(),
    id: raw.id,
    family: raw.family,
    kind: kindFor(raw.after),
    spanStart: range?.start ?? null,
    spanEnd: range?.end ?? null,
    before: range ? text.slice(range.start, range.end) : raw.span,
    after: raw.after,
    rationale: raw.rationale,
    status: 'pending',
  }
}

export function assembleFlags(text: string, a: PassAResult, shared: SharedResponse, passB: RawFlag[]): ReviewFlag[] {
  const raws: RawFlag[] = [...a.flags, ...passB]

  // Generative Tier 1 fixes (not mode-dependent candidates — those went
  // through Pass B). A missing fix leaves the flag with no proposed text.
  for (const f of a.fixRequests) {
    if (f.candidate) continue
    raws.push({ id: f.ruleId, family: f.family, start: f.start, end: f.end, span: f.span, after: shared.fixes[f.ref] ?? null, rationale: f.rationale })
  }

  // T1b-06 step 2: semicolons whose clauses aren't related enough.
  for (const s of shared.semicolons) {
    if (s.related) continue
    const inst = a.semicolons[s.index]
    if (!inst) continue
    const nextWordEnd = (() => {
      const m = text.slice(inst.end).match(/^\s*[\p{L}\p{N}][\p{L}\p{N}'’-]*/u)
      return m ? inst.end + m[0].length : inst.end
    })()
    raws.push({
      id: 'T1b-06',
      family: 'tier1b',
      start: inst.start,
      end: nextWordEnd,
      span: text.slice(inst.start, nextWordEnd),
      after: s.after?.trim() ? s.after : null,
      rationale: s.rationale || 'Semicolon joins clauses that read as separate sentences.',
    })
  }

  // The shared call's own flags (T1b-01/02, Tier 2, proofing) — quote-anchored.
  raws.push(...shared.flags.map((f) => ({ ...f })))

  const out: ReviewFlag[] = []
  const claimed: Range[] = []
  const seen = new Set<string>()
  for (const r of raws) {
    let range: Range | null = null
    if (r.start !== undefined && r.end !== undefined) range = { start: r.start, end: r.end }
    else {
      // A quote that doesn't match the live document downgrades to a
      // comment-only note (spanStart null), never a broken highlight.
      range = anchorQuote(text, r.span, claimed)
    }
    const dedupe = `${r.id}|${range?.start}|${range?.end}|${range ? '' : r.span}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    if (range) claimed.push(range)
    out.push(toReviewFlag(r, range, text))
  }
  // Document order; notes (no span) last.
  return out.sort((x, y) => (x.spanStart ?? Infinity) - (y.spanStart ?? Infinity) || (x.spanEnd ?? 0) - (y.spanEnd ?? 0))
}
