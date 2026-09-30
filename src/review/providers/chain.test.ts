import { afterEach, describe, expect, it, vi } from 'vitest'
import { chat, modelChain, PROVIDERS } from '.'
import { DEFAULT_CHAIN as GOOGLE } from './google'

// The failover chain: an unavailable model hands over to the next; a
// request that is itself wrong stops at once. Plus each provider's request
// shape where it differs.

const googleOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
const fail = (status: number, message = 'nope') => new Response(JSON.stringify({ error: { code: status, message } }), { status, statusText: 'x' })
const messages = [
  { role: 'system' as const, content: 'guide' },
  { role: 'user' as const, content: 'doc' },
]

function stub(...responses: Response[]) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) })
      return responses.shift()!
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('failover chain', () => {
  it('answers from the first model when it is available', async () => {
    const calls = stub(googleOk('{"a":1}'))
    expect(await chat('google', GOOGLE, 'k', messages)).toEqual({ content: '{"a":1}', model: GOOGLE[0] })
    expect(calls).toHaveLength(1)
  })

  it('moves on when a model is overloaded or out of quota', async () => {
    const calls = stub(fail(503), fail(429), googleOk('{}'))
    const r = await chat('google', GOOGLE, 'k', messages)
    expect(r.model).toBe(GOOGLE[2])
    expect(calls.map((c) => c.url.match(/models\/([^:]+):/)![1])).toEqual(GOOGLE.slice(0, 3))
  })

  it('stops at once on a request error (bad key)', async () => {
    const calls = stub(fail(400, 'API key not valid'))
    await expect(chat('google', GOOGLE, 'k', messages)).rejects.toMatchObject({ status: 400 })
    expect(calls).toHaveLength(1)
  })

  it('reports every attempt when all models are unavailable', async () => {
    stub(...GOOGLE.map(() => fail(503, 'overloaded')))
    await expect(chat('google', GOOGLE, 'k', messages)).rejects.toMatchObject({ status: 503, raw: expect.stringContaining(GOOGLE[3]) })
  })

  it("keeps a single model's own error as it is", async () => {
    stub(fail(429, 'slow down'))
    await expect(chat('google', ['gemini-flash-latest'], 'k', messages)).rejects.toMatchObject({ status: 429, message: 'slow down' })
  })

  it("treats Anthropic's 529 (overloaded) as unavailable", async () => {
    const ok = new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] }), { status: 200 })
    const calls = stub(fail(529), ok)
    expect((await chat('anthropic', ['a', 'b'], 'k', messages)).model).toBe('b')
    expect(calls).toHaveLength(2)
  })

  it("uses the person's chain, or the default when none is set", () => {
    expect(modelChain({}, 'openai')).toEqual(PROVIDERS.openai.defaultChain)
    expect(modelChain({ openai: [] }, 'openai')).toEqual(PROVIDERS.openai.defaultChain)
    expect(modelChain({ openai: ['x', 'y'] }, 'openai')).toEqual(['x', 'y'])
  })
})

describe('request shapes', () => {
  it('Google: folds the guide into the prompt and drops JSON mode for Gemma', async () => {
    const calls = stub(fail(503), fail(503), googleOk('{}'))
    await chat('google', GOOGLE, 'k', messages)
    expect(calls[0].body.systemInstruction).toBeDefined()
    expect(calls[2].body.systemInstruction).toBeUndefined()
    expect(calls[2].body.generationConfig).toEqual({ temperature: 0 })
    expect(JSON.stringify(calls[2].body.contents)).toContain('guide')
  })

  it('Anthropic: system apart, browser access header, text blocks only', async () => {
    const calls = stub(new Response(JSON.stringify({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"ok":1}' }] }), { status: 200 }))
    expect((await chat('anthropic', ['claude-haiku-4-5'], 'k', messages)).content).toBe('{"ok":1}')
    expect(calls[0].headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(calls[0].body.system).toBe('guide')
    expect(calls[0].body.messages).toEqual([{ role: 'user', content: 'doc' }])
    expect(calls[0].body.temperature).toBeUndefined()
  })

  it('OpenAI: JSON mode, no temperature', async () => {
    const calls = stub(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }))
    await chat('openai', ['gpt-5-mini'], 'k', messages)
    expect(calls[0].body.response_format).toEqual({ type: 'json_object' })
    expect(calls[0].body.temperature).toBeUndefined()
    expect(calls[0].headers.Authorization).toBe('Bearer k')
  })
})
