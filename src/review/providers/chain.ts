import { ReviewRequestError } from '../request'

// Failover along a provider's model chain (Phase 12; Google's chain came
// first): when a model is overloaded or out of quota the review moves on to
// the next. A failure that isn't about availability (bad key, malformed
// request) stops at once — the next model would fail the same way.

// Statuses that mean "this model can't answer right now", not "this request
// is wrong": not served, rate-limited or out of quota, server error,
// overloaded (Anthropic's 529).
export const FAIL_OVER = new Set([404, 429, 500, 502, 503, 529])

// Asks each model in turn until one answers. If every model is
// unavailable, the error is the last one's, with each attempt listed in the
// detail panel.
export async function walk(chain: string[], ask: (model: string) => Promise<string>): Promise<{ content: string; model: string }> {
  if (!chain.length) throw new ReviewRequestError('No model is set for this provider', 'parse', 'Add a model in the AI Provider panel.')
  const attempts: string[] = []
  let last: ReviewRequestError | null = null
  for (const model of chain) {
    try {
      return { content: await ask(model), model }
    } catch (e) {
      if (!(e instanceof ReviewRequestError) || typeof e.status !== 'number' || !FAIL_OVER.has(e.status)) throw e
      last = e
      attempts.push(`${model}: ${e.status} ${e.message}`)
    }
  }
  if (chain.length === 1) throw last!
  throw new ReviewRequestError(`Every model was unavailable — ${last!.message}`, last!.status, `Tried in order:\n${attempts.join('\n')}\n\nLast response:\n${last!.raw}`)
}

// A key test against a provider's model list: listing is free and touches
// nothing. `rejectedStatuses` = what the provider answers a bad key with;
// anything else (or no answer) means the key was never checked.
export async function testByListing(url: string, headers: Record<string, string>, rejectedStatuses = [401, 403]) {
  try {
    const res = await fetch(url, { headers })
    if (res.ok) return { ok: true as const }
    if (rejectedStatuses.includes(res.status)) return { ok: false as const, reason: 'rejected' as const, status: res.status }
    return { ok: false as const, reason: 'offline' as const, status: res.status }
  } catch {
    return { ok: false as const, reason: 'offline' as const }
  }
}
