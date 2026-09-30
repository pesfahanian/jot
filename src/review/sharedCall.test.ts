import { describe, expect, it } from 'vitest'
import { runPassA } from './passA'
import { buildSharedRequest, parseSharedResponse } from './sharedCall'

// The shared call's reply without JSON mode: the model may wrap the object in
// prose, a code fence, or reasoning text. The parser must still find it.

const reply = { sections: [{ start: 'Intro text here.', mode: 'strict' }], flags: [{ id: 'SPL-001', family: 'spelling', span: 'recieve', after: 'receive', rationale: 'Misspelling.' }], tricolons: [] }

describe('parseSharedResponse', () => {
  it('reads a bare JSON object', () => {
    expect(parseSharedResponse(JSON.stringify(reply)).flags[0].after).toBe('receive')
  })

  it('reads JSON inside a ```json fence with prose around it', () => {
    const r = parseSharedResponse(`Here is the review:\n\`\`\`json\n${JSON.stringify(reply)}\n\`\`\`\nDone.`)
    expect(r.sections[0].mode).toBe('strict')
  })

  it('ignores reasoning text, even when it contains braces', () => {
    const r = parseSharedResponse(`<think>The user wants {sections} first; consider {"x": 1}.</think>\n${JSON.stringify(reply)}`)
    expect(r.flags).toHaveLength(1)
  })

  it('never lets a Tier 2 flag carry a fix', () => {
    const r = parseSharedResponse(JSON.stringify({ ...reply, flags: [{ id: 'T2-01', family: 'tier2', span: 'robust', after: 'x', rationale: '' }] }))
    expect(r.flags[0].after).toBeNull()
  })

  it('fails loudly on a reply with no JSON, keeping the raw text for the error panel', () => {
    expect(() => parseSharedResponse('Sorry, I cannot help with that.')).toThrow(/did not return JSON/)
  })
})

// The model may decline a document that isn't prose (suitability.ts).
describe('declining', () => {
  it('reads a skip, ignoring anything else in the reply', () => {
    expect(parseSharedResponse('{"skip": "random characters, not prose"}').skip).toBe('random characters, not prose')
    expect(parseSharedResponse(JSON.stringify({ ...reply, skip: '  lorem ipsum  ' }))).toMatchObject({ skip: 'lorem ipsum', flags: [] })
  })

  it('treats an empty skip as no skip', () => {
    expect(parseSharedResponse(JSON.stringify({ ...reply, skip: '' })).skip).toBeUndefined()
  })

  it('offers the model the way out unless the review is forced', () => {
    const a = runPassA('Some text to review.')
    const user = (allow: boolean) => buildSharedRequest('Some text to review.', a, allow).messages[1].content
    expect(user(true)).toContain('"skip"')
    expect(user(false)).not.toContain('"skip"')
  })
})
