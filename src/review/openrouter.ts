// Direct browser → OpenRouter calls with the person's own key (ADR-004).
// No backend: OpenRouter is CORS-enabled and takes a plain Bearer header.

const BASE = 'https://openrouter.ai/api/v1'

// The model for the shared review call. Owner's choice (open-decisions #6):
// a free model for now. Free OpenRouter models are rate-limited, so a busy
// period surfaces as the review control's "review failed 429 · retry".
export const REVIEW_MODEL = 'google/gemma-4-26b-a4b-it:free'

export type KeyTest = { ok: true } | { ok: false; reason: 'rejected' | 'offline'; status?: number }

// Test = the save (7a): a key is stored only after this passes. 401/403
// means the key itself is wrong; anything network-level means it was never
// checked, which is not the same claim.
export async function testKey(key: string): Promise<KeyTest> {
  try {
    const res = await fetch(`${BASE}/key`, { headers: { Authorization: `Bearer ${key}` } })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'rejected', status: res.status }
    return { ok: false, reason: 'offline', status: res.status }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}

export class ReviewRequestError extends Error {
  readonly status: number | 'network' | 'parse'
  // The full response (or failure) as received, for the error panel —
  // OpenRouter puts the provider's own reason in error.metadata.
  readonly raw: string
  constructor(message: string, status: number | 'network' | 'parse', raw = '') {
    super(message)
    this.status = status
    this.raw = raw
  }
}

// Pretty-prints JSON bodies; anything else comes back as-is.
function prettyBody(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export async function chat(key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Jot',
      },
      body: JSON.stringify({
        model: REVIEW_MODEL,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ReviewRequestError('Could not reach OpenRouter', 'network', String(e))
  }
  const text = await res.text()
  if (!res.ok) {
    let detail = ''
    try {
      detail = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? ''
    } catch {
      /* body wasn't JSON */
    }
    throw new ReviewRequestError(detail || `OpenRouter returned ${res.status}`, res.status, `HTTP ${res.status} ${res.statusText}\n\n${prettyBody(text)}`)
  }
  let body: { choices?: { message?: { content?: string } }[] }
  try {
    body = JSON.parse(text)
  } catch {
    throw new ReviewRequestError('OpenRouter returned a response that is not JSON', 'parse', text)
  }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new ReviewRequestError('Empty response from the model', 'parse', prettyBody(text))
  return content
}
