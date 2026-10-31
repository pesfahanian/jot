import { describe, expect, it } from 'vitest'
import { annotatedMarkdown, drawable, markSource, pieces } from './annotatedSource'
import type { Annotation } from './db'

const base = { documentId: 'd', createdAt: 0, updatedAt: 0 }
const at = (text: string, quote: string, kind: Annotation['kind'] = 'highlight', extra: Partial<Annotation> = {}): Annotation => {
  const from = text.indexOf(quote)
  return { ...base, id: `${kind}-${from}`, kind, color: 1, from, to: from + quote.length, quote, ...extra }
}
const slices = (text: string, r: [number, number][]) => r.map(([a, b]) => text.slice(a, b))

describe('annotations through markdown', () => {
  it('cut at line ends and past line-start markdown', () => {
    const t = '## Title here\n- item one\nplain'
    const a = at(t, 'Title here\n- item one\npl')
    expect(slices(t, drawable(t, a.from, a.to))).toEqual(['Title here', 'item one', 'pl'])
  })
  it('take inline code whole and leave code blocks alone', () => {
    const t = 'run `npm install` now\n```js\nconst x = 1\n```\nafter'
    const a = at(t, 'install` now\n```js\nconst x = 1\n```\naft')
    expect(slices(t, drawable(t, a.from, a.to))).toEqual(['`npm install` now', 'aft'])
  })
  it('cut table rows into cells', () => {
    const t = '| a b | c d |\n|---|---|'
    const a = at(t, 'b | c')
    expect(slices(t, drawable(t, a.from, a.to)).map((s) => s.trim())).toEqual(['b', 'c'])
  })
  it('split overlapping annotations into clean pieces', () => {
    const t = 'one two three four'
    const list = [at(t, 'one two three'), at(t, 'two three four', 'underline')]
    expect(pieces(t, list).map((p) => [t.slice(p.from, p.to), p.ids.length])).toEqual([['one ', 1], ['two three', 2], [' four', 1]])
    const marked = markSource(t, list).text
    expect(marked.replace(/[-]\d*?/g, '')).toBe(t)
  })
  it('export highlights as ==text== and notes as footnotes', () => {
    const t = 'Saved as you type.\n\nNo save button.'
    const list = [at(t, 'as you'), at(t, 'save button', 'note', { body: 'check this' }), at(t, 'Saved', 'underline')]
    expect(annotatedMarkdown(t, list)).toBe('Saved ==as you== type.\n\nNo save button[^1].\n\n[^1]: check this\n')
  })
})
