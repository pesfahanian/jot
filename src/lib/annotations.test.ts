import { describe, expect, it } from 'vitest'
import { anchorAnnotations, covers, erase, mapAnnotations, paint } from './annotations'
import type { Annotation } from './db'

const text = 'Everything is saved as you type. There is no save button.'
const base = { documentId: 'd', createdAt: 0, updatedAt: 0 }
const hl = (from: number, to: number, color: 1 | 2 | 3 = 1, t = text): Annotation => ({ ...base, id: `h${from}`, kind: 'highlight', color, from, to, quote: t.slice(from, to) })
const note = (from: number, to: number): Annotation => ({ ...base, id: `n${from}`, kind: 'note', from, to, quote: text.slice(from, to), body: 'check' })
// A simple insertion / deletion at one place, as a change set maps it.
const edit = (at: number, removed: number, inserted: number) => ({
  mapPos: (pos: number, assoc = -1) => (pos < at || (pos === at && assoc < 0 && removed === 0) ? pos : pos <= at + removed ? (assoc < 0 ? at : at + inserted) : pos - removed + inserted),
})

describe('annotations', () => {
  it('follow an edit before, inside and across them', () => {
    const typed = 'Oh. ' + text
    const [a] = mapAnnotations([hl(14, 19)], edit(0, 0, 4), typed)
    expect(typed.slice(a.from, a.to)).toBe('saved')
    // Deleting a highlight's whole text removes it; a note stays, empty.
    const cut = text.slice(0, 14) + text.slice(20)
    expect(mapAnnotations([hl(14, 19)], edit(14, 6, 0), cut)).toHaveLength(0)
    const kept = mapAnnotations([note(14, 19)], edit(14, 6, 0), cut)
    expect(kept).toHaveLength(1)
    expect(kept[0].from).toBe(kept[0].to)
  })
  it('find their text again after an outside change, or let go', () => {
    const changed = 'Look: ' + text
    const [a] = anchorAnnotations([hl(14, 19)], changed)
    expect(changed.slice(a.from, a.to)).toBe('saved')
    expect(anchorAnnotations([hl(14, 19)], 'nothing like it')).toHaveLength(0)
    expect(anchorAnnotations([note(14, 19)], 'nothing like it')[0].quote).toBe('')
  })
  it('paint over part of a mark cuts it, and erase removes a stretch', () => {
    const painted = paint([hl(0, 19, 1)], { documentId: 'd', kind: 'highlight', color: 2 }, 6, 13, text)
    expect(painted.map((a) => [a.color, text.slice(a.from, a.to)]).sort()).toEqual([[1, 'Everyt'], [1, ' saved'], [2, 'hing is']].sort())
    const erased = erase([hl(0, 19)], 'highlight', 5, 10, text)
    expect(erased.map((a) => text.slice(a.from, a.to))).toEqual(['Every', ' is saved'])
  })
  it('know when a range is already covered', () => {
    const list = [hl(0, 10, 1), hl(10, 19, 1)]
    expect(covers(list, 'highlight', 2, 15, 1)).toBe(true)
    expect(covers(list, 'highlight', 2, 25, 1)).toBe(false)
    expect(covers(list, 'highlight', 2, 15, 2)).toBe(false)
  })
})
