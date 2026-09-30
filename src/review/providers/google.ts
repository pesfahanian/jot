import { failure, prettyBody, ReviewRequestError, send, type ChatMessage, type KeyTest } from '../request'
import { testByListing } from './chain'

// Direct browser → Google AI Studio (Gemini API) calls with the person's own
// key (ADR-004 amendment). The Gemini API accepts browser calls with the key
// in the x-goog-api-key header — never in the URL.

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Default chain (owner's call). Each model has its own free-tier quota on
// AI Studio, so a 429 on one says nothing about the next.
//   gemini-flash-latest       Google's rolling alias for current Flash
//   gemini-flash-lite-latest  lighter, less in demand, larger free quota
//   gemma-4-31b-it            open model; no system instruction and no JSON
//   gemma-3-27b-it            mode on this API, so those are folded into the
//                             prompt. Gemma 3 covers Gemma 4 not being served.
export const DEFAULT_CHAIN = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemma-4-31b-it', 'gemma-3-27b-it']

// Gemini models take systemInstruction and responseMimeType; Gemma models
// reject both.
const isGemma = (model: string) => model.startsWith('gemma')

// Google answers a bad key with 400 (API_KEY_INVALID) rather than 401.
export function testKey(key: string): Promise<KeyTest> {
  return testByListing(`${BASE}/models?pageSize=1`, { 'x-goog-api-key': key }, [400, 401, 403])
}

// The models that can answer a review: those that generate content.
export async function listModels(key: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) return []
  const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
  return (body.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

function body(model: string, messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content)
  if (!isGemma(model))
    return {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: user.map((text) => ({ role: 'user', parts: [{ text }] })),
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }
  // Gemma: the guide rides at the top of the one user turn.
  return {
    contents: [{ role: 'user', parts: [{ text: [system, ...user].filter(Boolean).join('\n\n') }] }],
    generationConfig: { temperature: 0 },
  }
}

export async function ask(model: string, key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await send(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body(model, messages)),
    },
    'Google AI Studio',
  )
  const text = await res.text()
  if (!res.ok) throw failure(res, text, 'Google AI Studio')
  let parsed: GeminiResponse
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ReviewRequestError('Google AI Studio returned a response that is not JSON', 'parse', text)
  }
  // Thought summaries, when present, are separate parts marked thought.
  const content = (parsed.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
  if (!content) {
    const why = parsed.promptFeedback?.blockReason ?? parsed.candidates?.[0]?.finishReason
    throw new ReviewRequestError(why ? `Empty response from the model (${why})` : 'Empty response from the model', 'parse', prettyBody(text))
  }
  return content
}
