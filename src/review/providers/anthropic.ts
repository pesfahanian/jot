import { failure, prettyBody, ReviewRequestError, send, type ChatMessage, type KeyTest } from '../request'
import { testByListing } from './chain'

// Direct browser → Anthropic calls with the person's own key (Phase 12).
// Plain fetch like the other providers — no SDK in the bundle. The API
// answers browser calls only when asked to with the direct-access header;
// the key is the person's own, kept in this browser (ADR-004).

const BASE = 'https://api.anthropic.com/v1'
const headers = (key: string) => ({
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
})

// Fast and cheap first, then the current Sonnet.
export const DEFAULT_CHAIN = ['claude-haiku-4-5', 'claude-sonnet-5-5']

export function testKey(key: string): Promise<KeyTest> {
  return testByListing(`${BASE}/models?limit=1`, headers(key))
}

export async function listModels(key: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models?limit=1000`, { headers: headers(key) })
  if (!res.ok) return []
  const body = (await res.json()) as { data?: { id: string }[] }
  return (body.data ?? []).map((m) => m.id)
}

interface MessagesResponse {
  content?: { type: string; text?: string }[]
  stop_reason?: string
}

export async function ask(model: string, key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const res = await send(
    `${BASE}/messages`,
    {
      method: 'POST',
      signal,
      headers: { ...headers(key), 'content-type': 'application/json' },
      // No sampling parameters: current models accept only the defaults.
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        ...(system ? { system } : {}),
        messages: messages.filter((m) => m.role === 'user').map((m) => ({ role: 'user', content: m.content })),
      }),
    },
    'Anthropic',
  )
  const text = await res.text()
  if (!res.ok) throw failure(res, text, 'Anthropic')
  let body: MessagesResponse
  try {
    body = JSON.parse(text)
  } catch {
    throw new ReviewRequestError('Anthropic returned a response that is not JSON', 'parse', text)
  }
  // Thinking blocks, when present, sit beside the text; only text counts.
  const content = (body.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
  if (!content) throw new ReviewRequestError(body.stop_reason ? `Empty response from the model (${body.stop_reason})` : 'Empty response from the model', 'parse', prettyBody(text))
  return content
}
