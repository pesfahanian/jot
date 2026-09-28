// What every AI provider shares: the message shape the shared call builds,
// and the error the review control shows (status code + the full response
// as received, for the error panel).

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export type KeyTest = { ok: true } | { ok: false; reason: 'rejected' | 'offline'; status?: number }

export class ReviewRequestError extends Error {
  readonly status: number | 'network' | 'parse'
  // The full response (or failure) as received, for the error panel —
  // providers put their own reason in the body.
  readonly raw: string
  constructor(message: string, status: number | 'network' | 'parse', raw = '') {
    super(message)
    this.status = status
    this.raw = raw
  }
}

// Pretty-prints JSON bodies; anything else comes back as-is.
export function prettyBody(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

// fetch, with a dropped connection turned into a ReviewRequestError (an
// abort passes through untouched).
export async function send(url: string, init: RequestInit, host: string): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ReviewRequestError(`Could not reach ${host}`, 'network', String(e))
  }
}

// A non-2xx response as a ReviewRequestError carrying the provider's own
// message (both providers put it at error.message).
export function failure(res: Response, text: string, provider: string): ReviewRequestError {
  let detail = ''
  try {
    detail = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    /* body wasn't JSON */
  }
  return new ReviewRequestError(detail || `${provider} returned ${res.status}`, res.status, `HTTP ${res.status} ${res.statusText}\n\n${prettyBody(text)}`)
}
