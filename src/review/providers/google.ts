import { failure, prettyBody, ReviewRequestError, send, type ChatMessage, type KeyTest } from '../request'

// Direct browser → Google AI Studio (Gemini API) calls with the person's own
// key (ADR-004 amendment). The Gemini API accepts browser calls with the key
// in the x-goog-api-key header — never in the URL.

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Google's rolling alias for its current Flash model: fast, in the free
// tier, and it takes JSON mode (responseMimeType).
export const MODEL = 'gemini-flash-latest'

// Test = the save (7a). Listing models is free and touches nothing. Google
// answers a bad key with 400 (API_KEY_INVALID) rather than 401.
export async function testKey(key: string): Promise<KeyTest> {
  try {
    const res = await fetch(`${BASE}/models?pageSize=1`, { headers: { 'x-goog-api-key': key } })
    if (res.ok) return { ok: true }
    if (res.status === 400 || res.status === 401 || res.status === 403) return { ok: false, reason: 'rejected', status: res.status }
    return { ok: false, reason: 'offline', status: res.status }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

export async function chat(key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const user = messages.filter((m) => m.role === 'user')
  const res = await send(
    `${BASE}/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: user.map((m) => ({ role: 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
    'Google AI Studio',
  )
  const text = await res.text()
  if (!res.ok) throw failure(res, text, 'Google AI Studio')
  let body: GeminiResponse
  try {
    body = JSON.parse(text)
  } catch {
    throw new ReviewRequestError('Google AI Studio returned a response that is not JSON', 'parse', text)
  }
  // Thought summaries, when present, are separate parts marked thought.
  const content = (body.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
  if (!content) {
    const why = body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason
    throw new ReviewRequestError(why ? `Empty response from the model (${why})` : 'Empty response from the model', 'parse', prettyBody(text))
  }
  return content
}
