import { describe, expect, it } from 'vitest'
import { runPassA } from './passA'
import { runPassAFa } from './fa/passA'

// The sentence-length variance rule (T1-09 / FA-T1-21, owner 2026-10-19):
// only paragraph sentences count, and a monotonous stretch is one finding,
// not a flag on every sentence in it.

const even = (n: number, words: string) => Array.from({ length: n }, () => words).join(' ')
const S = 'The team ships a small release every week.' // 8 words

describe('sentence-length variance', () => {
  it('flags a monotonous stretch once, across overlapping windows', () => {
    const flags = runPassA(even(8, S)).flags.filter((f) => f.id === 'T1-09')
    expect(flags).toHaveLength(1)
    expect(flags[0].after).toBeNull()
    expect(flags[0].rationale).toContain('8 sentences in a row')
  })
  it('ignores list items and headings', () => {
    const list = Array.from({ length: 8 }, () => `- ${S}`).join('\n')
    expect(runPassA(`# Notes\n\n${list}`).flags.filter((f) => f.id === 'T1-09')).toHaveLength(0)
  })
  it('leaves varied prose alone', () => {
    const varied = [S, 'Short.', 'This one runs on for quite a while longer than the others in the paragraph do.', S, 'Yes.', S].join(' ')
    expect(runPassA(varied).flags.filter((f) => f.id === 'T1-09')).toHaveLength(0)
  })
  it('works the same way in Farsi', () => {
    const fa = 'تیم ما هر هفته یک نسخهٔ کوچک منتشر می‌کند.'
    const flags = runPassAFa(even(7, fa)).flags.filter((f) => f.id === 'FA-T1-21')
    expect(flags).toHaveLength(1)
    expect(flags[0].after).toBeNull()
  })
})
