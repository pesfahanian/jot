import { describe, expect, it } from 'vitest'
import { parseSharedResponse } from './sharedCall'

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
