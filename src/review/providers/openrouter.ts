import { failure, prettyBody, ReviewRequestError, send, type ChatMessage, type KeyTest } from '../request'
import { testByListing } from './chain'

// Direct browser → OpenRouter calls with the person's own key (ADR-004).
// No backend: OpenRouter is CORS-enabled and takes a plain Bearer header.

const BASE = 'https://openrouter.ai/api/v1'

// Default (owner's choice, open-decisions #6): free, and light — the only
// free Qwen. Earlier free picks failed in testing (Gemma 4: shared-pool
// 429s; Nemotron 3 Ultra: 4+ minutes).
export const DEFAULT_CHAIN = ['qwen/qwen3.8-27b:free']

// 401/403 means the key itself is wrong; anything network-level means it
// was never checked, which is not the same claim.
export function testKey(key: string): Promise<KeyTest> {
  return testByListing(`${BASE}/key`, { Authorization: `Bearer ${key}` })
}

// OpenRouter's catalogue is public; text-out models only.
export async function listModels(): Promise<string[]> {
  const res = await fetch(`${BASE}/models`)
  if (!res.ok) return []
  const body = (await res.json()) as { data?: { id: string; architecture?: { output_modalities?: string[] } }[] }
  return (body.data ?? []).filter((m) => m.architecture?.output_modalities?.includes('text') ?? true).map((m) => m.id)
}

export async function ask(model: string, key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await send(
    `${BASE}/chat/completions`,
    {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'jot',
      },
      // No JSON mode: not every model takes it, and the prompt's "one JSON
      // object and nothing else" plus the tolerant parser carry the format.
      // Reasoning is switched off (ignored by models without it) so the
      // answer starts straight away and fits inside the review timeout.
      body: JSON.stringify({ model, messages, temperature: 0, reasoning: { enabled: false } }),
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
