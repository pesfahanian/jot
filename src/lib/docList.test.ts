import { describe, expect, it } from 'vitest'
import type { JotDocument, TagColor } from './db'
import { arrangeDocuments, colorCounts, filterByColors, relativeTime, searchDocuments, TAG_SLOTS, uniqueTitle } from './docList'

// T6.2 — the tag OR-filter (ADR-007), which produced the AND/OR mixup during
// design, plus the sidebar's ordering rules.

const doc = (title: string, color: TagColor | null, extra: Partial<JotDocument> = {}): JotDocument => ({
  id: title,
  title,
  content: '',
  color,
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
})

const docs = [doc('a', 1), doc('b', 2), doc('c', 2), doc('d', 4), doc('e', null), doc('f', 6, { pinned: true })]
const titles = (list: JotDocument[]) => list.map((d) => d.title).sort()

describe('color filter — logical OR', () => {
  it('shows everything with no colors selected', () => {
    expect(filterByColors(docs, new Set())).toHaveLength(docs.length)
  })

  it('shows every document of any selected color', () => {
    expect(titles(filterByColors(docs, new Set<TagColor>([2, 4])))).toEqual(['b', 'c', 'd'])
  })

  it('only ever adds documents as colors are added, never removes any', () => {
    // Every order of adding all six colors: each step's result contains the last.
    const orders = [[...TAG_SLOTS], [...TAG_SLOTS].reverse(), [4, 1, 6, 2, 5, 3] as TagColor[]]
    for (const order of orders) {
      const picked = new Set<TagColor>()
      let before: string[] = []
      for (const c of order) {
        picked.add(c)
        const now = titles(filterByColors(docs, picked))
        expect(now).toEqual(expect.arrayContaining(before))
        expect(now.length).toBeGreaterThanOrEqual(before.length)
        before = now
      }
    }
  })

  it('never matches an untagged document once a color is selected', () => {
    for (const c of TAG_SLOTS) expect(titles(filterByColors(docs, new Set([c])))).not.toContain('e')
  })

  it('filters pinned documents like any other — pinning is position, not membership', () => {
    expect(titles(filterByColors(docs, new Set<TagColor>([2])))).not.toContain('f')
    expect(titles(filterByColors(docs, new Set<TagColor>([6])))).toEqual(['f'])
  })

  it('counts per color, one color per document', () => {
    expect(colorCounts(docs)).toEqual({ 1: 1, 2: 2, 3: 0, 4: 1, 5: 0, 6: 1 })
  })
})

describe('ordering', () => {
  const list = [
    doc('beta', null, { updatedAt: 3 }),
    doc('alpha', null, { updatedAt: 1 }),
    doc('pinned-z', null, { pinned: true, updatedAt: 0 }),
    doc('gamma', null, { updatedAt: 2 }),
    doc('pinned-a', null, { pinned: true, updatedAt: 5 }),
  ]

  it('keeps pinned documents on top in both sort modes', () => {
    for (const mode of ['date', 'name'] as const) {
      const { pinned, rest } = arrangeDocuments(list, mode)
      expect(pinned.every((d) => d.pinned)).toBe(true)
      expect(rest.some((d) => d.pinned)).toBe(false)
    }
  })

  it('sorts newest first by date, A to Z by name', () => {
    expect(arrangeDocuments(list, 'date').rest.map((d) => d.title)).toEqual(['beta', 'gamma', 'alpha'])
    expect(arrangeDocuments(list, 'name').rest.map((d) => d.title)).toEqual(['alpha', 'beta', 'gamma'])
    expect(arrangeDocuments(list, 'name').pinned.map((d) => d.title)).toEqual(['pinned-a', 'pinned-z'])
  })
})

describe('search, timestamps, titles', () => {
  it('reports body hits with line numbers, and title-only matches as such', () => {
    const { results, matches } = searchDocuments(
      [doc('diff-harness', null, { content: 'nothing here' }), doc('spec', null, { content: 'one\nthe diff harness runs\nthree' })],
      'diff',
    )
    const spec = results.find((r) => r.doc.title === 'spec')!
    expect(spec.hits[0]).toMatchObject({ line: 2, text: 'the diff harness runs', ranges: [[4, 8]] })
    expect(results.find((r) => r.doc.title === 'diff-harness')).toMatchObject({ titleMatch: true, hits: [] })
    expect(matches).toBe(2)
  })

  it('formats relative time the way the sidebar shows it', () => {
    const now = 1_000_000_000_000
    expect(relativeTime(now - 30_000, now)).toBe('now')
    expect(relativeTime(now - 2 * 60_000, now)).toBe('2m')
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h')
    expect(relativeTime(now - 21 * 86_400_000, now)).toBe('21d')
    expect(relativeTime(now - 40 * 86_400_000, now)).toBe('1mo')
  })

  it('numbers untitled documents without colliding', () => {
    expect(uniqueTitle('untitled', [])).toBe('untitled')
    expect(uniqueTitle('untitled', [doc('untitled', null), doc('untitled-2', null)])).toBe('untitled-3')
  })
})
