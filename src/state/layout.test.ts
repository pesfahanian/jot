import { describe, expect, it } from 'vitest'
import type { PaneLayout } from '@/lib/db'
import { canSplit, docIdOf, isRenderTab, moveTab, splitWithTab } from './layout'

const pane = (id: string, tabs: string[], active = tabs[0] ?? null): PaneLayout => ({ id, tabs, active })
const tabsOf = (ps: PaneLayout[]) => ps.map((p) => `${p.id}:${p.tabs.join(',')}>${p.active}`)

describe('tab drag — reorder and move', () => {
  it('reorders within a strip, in either direction', () => {
    const ps = [pane('A', ['a', 'b', 'c'])]
    expect(tabsOf(moveTab(ps, { docId: 'a', from: 'A' }, 'A', 3)!.panes)).toEqual(['A:b,c,a>a'])
    expect(tabsOf(moveTab(ps, { docId: 'c', from: 'A' }, 'A', 0)!.panes)).toEqual(['A:c,a,b>c'])
    expect(tabsOf(moveTab(ps, { docId: 'a', from: 'A' }, 'A', 1)!.panes)).toEqual(['A:a,b,c>a'])
  })

  it('moves a tab into another pane at the slot, activating it there', () => {
    const r = moveTab([pane('A', ['a', 'b'], 'a'), pane('B', ['x', 'y'])], { docId: 'a', from: 'A' }, 'B', 1)!
    expect(tabsOf(r.panes)).toEqual(['A:b>b', 'B:x,a,y>a'])
    expect(r.focus).toBe('B')
  })

  it('closes the source pane when its last tab leaves', () => {
    const r = moveTab([pane('A', ['a']), pane('B', ['x'])], { docId: 'a', from: 'A' }, 'B', 1)!
    expect(tabsOf(r.panes)).toEqual(['B:x,a>a'])
  })

  it("doesn't duplicate a document the target already has open", () => {
    const r = moveTab([pane('A', ['a', 'b']), pane('B', ['a', 'x'])], { docId: 'a', from: 'A' }, 'B', 2)!
    expect(tabsOf(r.panes)).toEqual(['A:b>b', 'B:x,a>a'])
  })

  it('moves a rendered view like any tab — joining a pane beside other tabs', () => {
    const r = moveTab([pane('A', ['a']), pane('R', ['render:a'])], { docId: 'render:a', from: 'R' }, 'A', 1)!
    expect(tabsOf(r.panes)).toEqual(['A:a,render:a>render:a'])
    expect(isRenderTab('render:a') && docIdOf('render:a') === 'a' && docIdOf('a') === 'a').toBe(true)
  })
})

describe('tab drag — split on a pane edge', () => {
  it('opens a new column on the chosen side', () => {
    const ps = [pane('A', ['a', 'b']), pane('B', ['x'])]
    expect(tabsOf(splitWithTab(ps, { docId: 'b', from: 'A' }, 'B', 'right', 'N')!.panes)).toEqual(['A:a>a', 'B:x>x', 'N:b>b'])
    expect(tabsOf(splitWithTab(ps, { docId: 'b', from: 'A' }, 'A', 'left', 'N')!.panes)).toEqual(['N:b>b', 'A:a>a', 'B:x>x'])
  })

  it('keeps to three columns, counting a pane the move empties', () => {
    const three = [pane('A', ['a', 'b']), pane('B', ['x']), pane('C', ['y'])]
    expect(splitWithTab(three, { docId: 'b', from: 'A' }, 'C', 'right', 'N')).toBeNull()
    // B empties and closes, so there is room for the new column.
    expect(tabsOf(splitWithTab(three, { docId: 'x', from: 'B' }, 'C', 'right', 'N')!.panes)).toEqual(['A:a,b>a', 'C:y>y', 'N:x>x'])
  })

  it("is a no-op on a tab's own pane when it's the only tab", () => {
    const ps = [pane('A', ['a']), pane('B', ['x'])]
    expect(splitWithTab(ps, { docId: 'a', from: 'A' }, 'A', 'right', 'N')).toBeNull()
    expect(canSplit(ps, { docId: 'x', from: 'B' }, 'A')).toBe(true)
  })
})

describe('dragging a document in from the sidebar', () => {
  const ps = [pane('A', ['a', 'b']), pane('B', ['x'])]
  it('opens it in a strip at the slot, leaving every other pane as it was', () => {
    expect(tabsOf(moveTab(ps, { docId: 'n', from: null }, 'B', 0)!.panes)).toEqual(['A:a,b>a', 'B:n,x>n'])
  })
  it("moves rather than duplicates when the pane already has it open", () => {
    expect(tabsOf(moveTab(ps, { docId: 'b', from: null }, 'A', 0)!.panes)).toEqual(['A:b,a>b', 'B:x>x'])
  })
  it('opens it in a new column on a pane edge, within three columns', () => {
    expect(tabsOf(splitWithTab(ps, { docId: 'n', from: null }, 'A', 'left', 'N')!.panes)).toEqual(['N:n>n', 'A:a,b>a', 'B:x>x'])
    expect(splitWithTab([...ps, pane('C', ['y'])], { docId: 'n', from: null }, 'A', 'left', 'N')).toBeNull()
  })
})
