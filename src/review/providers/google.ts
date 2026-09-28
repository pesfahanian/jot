import { failure, prettyBody, ReviewRequestError, send, type ChatMessage, type KeyTest } from '../request'

// Direct browser → Google AI Studio (Gemini API) calls with the person's own
// key (ADR-004 amendment). The Gemini API accepts browser calls with the key
// in the x-goog-api-key header — never in the URL.

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Failover chain (owner's call): when a model is overloaded or out of quota
// the review moves on to the next, lighter one. Each model has its own
// free-tier quota on AI Studio, so a 429 on one says nothing about the next.
//   gemini-flash-latest       Google's rolling alias for current Flash
//   gemini-flash-lite-latest  lighter, less in demand, larger free quota
//   gemma-4-31b-it            open model; no system instruction and no JSON
//   gemma-3-27b-it            mode on this API, so those are folded into the
//                             prompt. Gemma 3 covers Gemma 4 not being served.
interface ModelSpec {
  id: string
  // Gemini models take systemInstruction and responseMimeType; Gemma
  // models reject both.
  gemini: boolean
}
export const CHAIN: ModelSpec[] = [
  { id: 'gemini-flash-latest', gemini: true },
  { id: 'gemini-flash-lite-latest', gemini: true },
  { id: 'gemma-4-31b-it', gemini: false },
  { id: 'gemma-3-27b-it', gemini: false },
]
export const MODEL = CHAIN[0].id

// Statuses that mean "this model can't answer right now", not "this request
// is wrong": overloaded, out of quota, server error, not served.
const FAIL_OVER = new Set([404, 429, 500, 503])

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

function body(spec: ModelSpec, messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content)
  if (spec.gemini)
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

async function ask(spec: ModelSpec, key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await send(
    `${BASE}/models/${spec.id}:generateContent`,
    {
      method: 'POST',
      signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body(spec, messages)),
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

// Walks the chain until a model answers. A failure that isn't about
// availability (bad key, malformed request) stops at once — the next model
// would fail the same way. If every model is unavailable, the error is the
// last one's, with each attempt listed in the detail panel.
export async function chat(key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<{ content: string; model: string }> {
  const attempts: string[] = []
  let last: ReviewRequestError | null = null
  for (const spec of CHAIN) {
    try {
      return { content: await ask(spec, key, messages, signal), model: spec.id }
    } catch (e) {
      if (!(e instanceof ReviewRequestError) || typeof e.status !== 'number' || !FAIL_OVER.has(e.status)) throw e
      last = e
      attempts.push(`${spec.id}: ${e.status} ${e.message}`)
    }
  }
  throw new ReviewRequestError(`Every model was unavailable — ${last!.message}`, last!.status, `Tried in order:\n${attempts.join('\n')}\n\nLast response:\n${last!.raw}`)
}
