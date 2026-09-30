import { failure, prettyBody, ReviewRequestError, send, type ChatMessage, type KeyTest } from '../request'
import { testByListing } from './chain'

// Direct browser → OpenAI calls with the person's own key (Phase 12). The
// API is CORS-enabled and takes a plain Bearer header.

const BASE = 'https://api.openai.com/v1'

// Light and fast first, then a sturdier fallback.
export const DEFAULT_CHAIN = ['gpt-5-mini', 'gpt-4.1-mini']

export function testKey(key: string): Promise<KeyTest> {
  return testByListing(`${BASE}/models`, { Authorization: `Bearer ${key}` })
}

// The list mixes every kind of model; keep the ones that chat.
const NOT_CHAT = /embedding|tts|whisper|dall-e|image|audio|realtime|transcribe|moderation|search|computer-use|babbage|davinci|sora/
export async function listModels(key: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) return []
  const body = (await res.json()) as { data?: { id: string }[] }
  return (body.data ?? [])
    .map((m) => m.id)
    .filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !NOT_CHAT.test(id))
    .sort()
}

export async function ask(model: string, key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await send(
    `${BASE}/chat/completions`,
    {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // No temperature: reasoning models accept only the default. JSON mode
      // is supported across current chat models.
      body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } }),
    },
    'OpenAI',
  )
  const text = await res.text()
  if (!res.ok) throw failure(res, text, 'OpenAI')
  let body: { choices?: { message?: { content?: string } }[] }
  try {
    body = JSON.parse(text)
  } catch {
    throw new ReviewRequestError('OpenAI returned a response that is not JSON', 'parse', text)
  }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new ReviewRequestError('Empty response from the model', 'parse', prettyBody(text))
  return content
}
