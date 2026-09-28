import { failure, prettyBody, ReviewRequestError, send, type ChatMessage, type KeyTest } from '../request'

// Direct browser → OpenRouter calls with the person's own key (ADR-004).
// No backend: OpenRouter is CORS-enabled and takes a plain Bearer header.

const BASE = 'https://openrouter.ai/api/v1'

// The model for the shared review call. Owner's choice (open-decisions #6):
// free, and light while the feature is being proven — the only free Qwen.
// Earlier free picks failed in testing (Gemma 4: shared-pool 429s;
// Nemotron 3 Ultra: 4+ minutes). Model and provider choice is a to-do.
export const MODEL = 'qwen/qwen3.8-27b:free'
// Whether the model accepts response_format: json_object (OpenRouter's model
// list says so per model). Without it, the prompt's "one JSON object and
// nothing else" and the tolerant parser carry the format.
const JSON_MODE = false
// A thinking model: its reasoning is switched off so the answer starts
// straight away and fits inside the review timeout.
const REASONING_OFF = true

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

export async function chat(key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await send(
    `${BASE}/chat/completions`,
    {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Jot',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0,
        ...(JSON_MODE ? { response_format: { type: 'json_object' } } : {}),
        ...(REASONING_OFF ? { reasoning: { enabled: false } } : {}),
      }),
    },
    'OpenRouter',
  )
  const text = await res.text()
  if (!res.ok) throw failure(res, text, 'OpenRouter')
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
