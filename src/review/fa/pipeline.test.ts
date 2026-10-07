import { afterEach, describe, expect, it, vi } from 'vitest'
import { produceReview } from '../pipeline'

// A Farsi document through the whole review — routing, the Farsi Pass A,
// the Farsi shared call, Pass B, anchoring — with the provider stubbed.

const DOC = [
  '## راهنمای انتشار',
  '',
  'در رابطه با انتشار نسخهٔ تازه، ما هر هفته کتاب ها را بررسی می‌کنیم و نتایج را ثبت می‌کنیم تا همه از وضعیت باخبر باشند.',
  '',
  'این سند مراحل انتشار را توضیح می‌دهد و هر مرحله یک مسئول دارد که پیش از رفتن به مرحلهٔ بعد باید تأیید کند.',
].join('\n')

afterEach(() => vi.unstubAllGlobals())

describe('a Farsi review, end to end', () => {
  it('uses the Farsi guide, runs the fixed rules, and anchors the model’s quotes', async () => {
    const sent: string[] = []
    const reply = {
      sections: [{ start: 'در رابطه با انتشار نسخهٔ تازه، ما هر هفته', mode: 'strict' }],
      // The model retypes the half-space as a space; the quote still anchors.
      flags: [{ id: 'FA-T2-11', family: 'tier2', span: 'در رابطه با انتشار نسخهٔ تازه', after: null, rationale: 'Calque of "in relation to".' },
              { id: 'FA-T2-02', family: 'tier2', span: 'و نتایج را ثبت می کنیم', after: null, rationale: 'Restates.' }],
      tricolons: [],
      fixes: {},
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(String(init.body))
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }), { status: 200 })
      }),
    )
    const session = await produceReview('d', DOC, 'google', ['gemini-flash-latest'], 'k')
    if ('skipped' in session) throw new Error('skipped')
    expect(session.rulesetVersion).toBe('fa rev 1')
    // The Farsi guide went to the model, without its client-only blocks
    // and without a proofing task.
    expect(sent[0]).toContain('Rules (Farsi)')
    expect(sent[0]).not.toContain('client:start')
    expect(sent[0]).not.toContain('SPL-001')
    // A fixed rule fired client-side: «کتاب ها» needs a half-space.
    const ha = session.flags.find((f) => f.id === 'FA-T1-02')!
    expect(ha.before).toBe('کتاب ها')
    expect(ha.after).toBe('کتاب‌ها')
    // Both model flags anchored to real text (one across a retyped half-space).
    const model = session.flags.filter((f) => f.id.startsWith('FA-T2'))
    expect(model).toHaveLength(2)
    expect(model.every((f) => f.spanStart !== null)).toBe(true)
    expect(DOC.slice(model[1].spanStart!, model[1].spanEnd!)).toBe('و نتایج را ثبت می‌کنیم')
  })
})
