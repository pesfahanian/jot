import type { ReviewFlag, ReviewSession } from '@/lib/db'
import { anchorQuote, type Range } from './anchor'
import { assembleFlags } from './assemble'
import { REVIEW_MODEL } from './openrouter'
import { runPassA } from './passA'
import { resolveSections, runPassB } from './passB'
import { RULESET_VERSION } from './ruleset'
import { runSharedCall } from './sharedCall'

// The full flag-production pipeline (checks.md "Execution model"):
//   Pass A (client) → one shared OpenRouter call → Pass B (client) → assemble
export async function produceReview(documentId: string, text: string, key: string, signal?: AbortSignal): Promise<ReviewSession> {
  const a = runPassA(text)
  const { response } = await runSharedCall(key, text, a, signal)
  const sections = resolveSections(text, a, response.sections)
  const b = runPassB(text, a, response, sections)
  const flags = assembleFlags(text, a, response, b)
  return { documentId, rulesetVersion: RULESET_VERSION, model: REVIEW_MODEL, source: text, createdAt: Date.now(), flags }
}

// Resuming a review whose document changed after it was closed: every flag
// is re-anchored by its original text near its old position, the same
// verbatim mechanism as first anchoring. A flag whose text is gone becomes
// a comment-only note.
export function reanchor(session: ReviewSession, text: string): ReviewSession {
  if (session.source === text) return session
  const claimed: Range[] = []
  const flags: ReviewFlag[] = session.flags.map((f) => {
    if (f.spanStart === null) return f
    const r = anchorQuote(text, f.before, claimed, f.spanStart)
    if (!r) return { ...f, spanStart: null, spanEnd: null }
    claimed.push(r)
    return { ...f, spanStart: r.start, spanEnd: r.end }
  })
  return { ...session, source: text, flags }
}
