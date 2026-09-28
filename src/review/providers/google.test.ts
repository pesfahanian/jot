import { afterEach, describe, expect, it, vi } from 'vitest'
import { chat, CHAIN } from './google'

// The failover chain: an unavailable model hands over to the next; a
// request that is itself wrong stops at once.

const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
const fail = (status: number, message = 'nope') => new Response(JSON.stringify({ error: { code: status, message } }), { status, statusText: 'x' })
const messages = [
  { role: 'system' as const, content: 'guide' },
  { role: 'user' as const, content: 'doc' },
]

function stub(...responses: Response[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) })
      return responses.shift()!
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('Google failover chain', () => {
  it('answers from the first model when it is available', async () => {
    const calls = stub(ok('{"a":1}'))
    expect(await chat('k', messages)).toEqual({ content: '{"a":1}', model: CHAIN[0].id })
    expect(calls).toHaveLength(1)
  })

  it('moves on when a model is overloaded or out of quota', async () => {
    const calls = stub(fail(503), fail(429), ok('{}'))
    const r = await chat('k', messages)
    expect(r.model).toBe(CHAIN[2].id)
    expect(calls.map((c) => c.url.match(/models\/([^:]+):/)![1])).toEqual(CHAIN.slice(0, 3).map((m) => m.id))
  })

  it('folds the guide into the prompt and drops JSON mode for Gemma', async () => {
    const calls = stub(fail(503), fail(503), ok('{}'))
    await chat('k', messages)
    expect(calls[0].body.systemInstruction).toBeDefined()
    expect(calls[2].body.systemInstruction).toBeUndefined()
    expect(calls[2].body.generationConfig).toEqual({ temperature: 0 })
    expect(JSON.stringify(calls[2].body.contents)).toContain('guide')
  })

  it('stops at once on a request error (bad key)', async () => {
    const calls = stub(fail(400, 'API key not valid'))
    await expect(chat('k', messages)).rejects.toMatchObject({ status: 400 })
    expect(calls).toHaveLength(1)
  })

  it('reports every attempt when all models are unavailable', async () => {
    stub(...CHAIN.map(() => fail(503, 'overloaded')))
    await expect(chat('k', messages)).rejects.toMatchObject({ status: 503, raw: expect.stringContaining(CHAIN[3].id) })
  })
})
