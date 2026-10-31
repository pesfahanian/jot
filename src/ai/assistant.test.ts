import { describe, expect, it } from 'vitest'
import { buildMessages, parseReply, toFlags } from './assistant'

const text = '# Welcome\n\nThis document is a short tour, and it is yours.\n\n- Lists continue.\n'

describe('AI mode assistant', () => {
  it('sends the document, the notes and the message in one turn', () => {
    const [, user] = buildMessages({
      title: 'welcome',
      text,
      message: 'Tighten it.',
      aiNotes: [{ n: 1, quote: 'short tour', body: 'friendlier' }],
      personalNotes: [],
      history: [{ id: 'a', at: 0, role: 'user', text: 'Is it clear?', notes: [], context: 0 }],
    })
    expect(user.content).toContain('<document title="welcome">')
    expect(user.content).toContain('1. On «short tour»: friendlier')
    expect(user.content).toContain('writer: Is it clear?')
    expect(user.content).toMatch(/The writer's message:\nTighten it\.$/)
  })
  it('reads a reply, tolerating thinking and fences, and an answer in prose', () => {
    const r = parseReply('<think>{"x":1}</think>```json\n{"answer":"Done.","proposals":[{"quote":"short tour","replacement":"quick tour","why":"lighter","note":1}],"declined":null}\n```')
    expect(r).toEqual({ answer: 'Done.', proposals: [{ quote: 'short tour', replacement: 'quick tour', why: 'lighter', note: 1 }], declined: null })
    expect(parseReply('It reads fine.')).toEqual({ answer: 'It reads fine.', proposals: [], declined: null })
    expect(parseReply('{"answer":"","proposals":[{"quote":"a","replacement":"b"}],"declined":"No."}').proposals).toEqual([])
  })
  it('anchors proposals, and keeps a misquoted one as a note', () => {
    const flags = toFlags(text, {
      answer: '',
      declined: null,
      proposals: [
        { quote: 'a short  tour', replacement: 'a quick tour', why: 'lighter', note: 1 },
        { quote: 'not in the text', replacement: 'x', why: '', note: null },
      ],
    })
    expect(flags[0]).toMatchObject({ id: 'ai note 1', family: 'chat', kind: 'replace', before: 'a short tour', after: 'a quick tour' })
    expect(text.slice(flags[0].spanStart!, flags[0].spanEnd!)).toBe('a short tour')
    expect(flags[1]).toMatchObject({ id: 'chat', kind: 'flag', spanStart: null })
  })
})
