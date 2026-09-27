import type { ReviewFlag, ReviewSession } from '@/lib/db'
import { anchorQuote, type Range } from './anchor'

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
