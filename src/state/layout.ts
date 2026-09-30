import type { PaneLayout } from '@/lib/db'

// Pane layout as pure moves, so they're testable without the UI.
//
// The grid (Phase 13): up to three columns, each one pane or two stacked.
// Panes stay one flat list, column by column — a pane marked `below` sits
// under the pane before it — so everything that only cares about panes
// (tabs, focus, sessions) never sees the grid. A column's top pane carries
// its width (`size`) and the stack's split.
//
// Tab drag (Phase 8, part A; part B in Phase 13): reorder within a strip,
// move to another pane's strip, or drop on a pane's edge — left/right for a
// new column there, top/bottom to stack a pane in that column. A tab moves:
// it leaves where it came from, and a pane left empty closes (6f).

export const MAX_COLUMNS = 3
export const MAX_ROWS = 2
export const MAX_PANES = MAX_COLUMNS * MAX_ROWS

// A tab is a document's editor (its id) or its rendered view ("render:" +
// id) — an ordinary tab, as VSCode's preview is, so every tab move applies.
const RENDER = 'render:'
export const renderTab = (docId: string) => RENDER + docId
export const isRenderTab = (tabId: string | null | undefined) => !!tabId?.startsWith(RENDER)
export const docIdOf = (tabId: string) => (tabId.startsWith(RENDER) ? tabId.slice(RENDER.length) : tabId)

export interface DraggedTab {
  // The tab's id: a document id, or a rendered view's "render:" id.
  docId: string
  // The pane it's dragged out of — or null for a document dragged in from
  // the sidebar, which opens where it's dropped rather than moving.
  from: string | null
}

export interface LayoutResult {
  panes: PaneLayout[]
  focus: string
}

export type Edge = 'left' | 'right' | 'top' | 'bottom'

// ---- the grid ----

// The panes grouped into columns, top pane first.
export function columnsOf(panes: PaneLayout[]): PaneLayout[][] {
  const cols: PaneLayout[][] = []
  for (const p of panes) {
    const last = cols[cols.length - 1]
    if (p.below && last && last.length < MAX_ROWS) last.push(p)
    else cols.push([p])
  }
  return cols
}

// Back to a flat list, with `below` and the column's size and split kept on
// whichever pane is now on top.
function flatten(cols: PaneLayout[][]): PaneLayout[] {
  return cols.flatMap((col) =>
    col.map((p, i) => {
      const rest = bare(p)
      if (i > 0) return { ...rest, below: true }
      const top: PaneLayout = { ...rest }
      if (p.size !== undefined) top.size = p.size
      if (col.length > 1 && p.split !== undefined) top.split = p.split
      return top
    }),
  )
}

// A valid grid from anything: `below` only under a top pane, at most three
// columns (extra columns are dropped). Used on load.
export function tidy(panes: PaneLayout[]): PaneLayout[] {
  return flatten(columnsOf(panes).slice(0, MAX_COLUMNS))
}

// Removes a pane. When a column's top pane goes, the pane below takes its
// place and keeps the column's width.
export function removePane(panes: PaneLayout[], paneId: string): PaneLayout[] {
  return flatten(
    columnsOf(panes)
      .map((col) => {
        const i = col.findIndex((p) => p.id === paneId)
        if (i === -1) return col
        if (i === 0 && col.length > 1) return [{ ...col[1], below: false, size: col[0].size }]
        return col.filter((p) => p.id !== paneId)
      })
      .filter((col) => col.length > 0),
  )
}

// Takes a tab out of a pane: its neighbour becomes active, and a pane left
// empty closes unless it's the only one.
function removeTab(panes: PaneLayout[], paneId: string | null, docId: string): PaneLayout[] {
  if (paneId === null) return panes
  const p = panes.find((q) => q.id === paneId)
  if (!p) return panes
  const i = p.tabs.indexOf(docId)
  if (i === -1) return panes
  const tabs = p.tabs.filter((t) => t !== docId)
  if (tabs.length === 0 && panes.length > 1) return removePane(panes, paneId)
  const active = p.active === docId ? (tabs[Math.min(i, tabs.length - 1)] ?? null) : p.active
  return panes.map((q) => (q.id === paneId ? { ...q, tabs, active } : q))
}

// A new pane beside or in `target`'s column. Left/right: a new column,
// which takes half of the target column's width. Top/bottom: stacked in the
// target's column, half and half. Null when the grid has no room there.
export function insertPane(panes: PaneLayout[], target: string, edge: Edge, pane: PaneLayout): PaneLayout[] | null {
  const cols = columnsOf(panes)
  const ci = cols.findIndex((col) => col.some((p) => p.id === target))
  if (ci === -1) return null
  const col = cols[ci]
  const size = col[0].size ?? 1
  if (edge === 'left' || edge === 'right') {
    if (cols.length >= MAX_COLUMNS) return null
    const halved = [{ ...col[0], size: size / 2 }, ...col.slice(1)]
    const added = [{ ...pane, size: size / 2 }]
    const next = [...cols.slice(0, ci), ...(edge === 'left' ? [added, halved] : [halved, added]), ...cols.slice(ci + 1)]
    return flatten(next)
  }
  if (col.length >= MAX_ROWS) return null
  const [top] = col
  const stacked = edge === 'top' ? [{ ...pane, size: top.size, split: 0.5 }, { ...top, below: true }] : [{ ...top, split: 0.5 }, { ...pane, below: true }]
  return flatten([...cols.slice(0, ci), stacked, ...cols.slice(ci + 1)])
}

// Sets columns' widths and stacks' splits by pane id (on column top panes).
export function resize(panes: PaneLayout[], sizes: Record<string, { size?: number; split?: number }>): PaneLayout[] {
  return panes.map((p) => (sizes[p.id] ? { ...p, ...sizes[p.id] } : p))
}

// A pane without its place in the grid.
function bare(p: PaneLayout): PaneLayout {
  const { below, size, split, ...rest } = p
  void below
  void size
  void split
  return rest
}

// ---- tab moves ----

// Into `to`'s strip at `index` (a slot between tabs, 0 = first), active
// there. Within one strip this is a reorder.
export function moveTab(panes: PaneLayout[], tab: DraggedTab, to: string, index: number): LayoutResult | null {
  const target = panes.find((p) => p.id === to)
  if (!target) return null
  if (tab.from === to) {
    const at = target.tabs.indexOf(tab.docId)
    if (at === -1) return null
    const tabs = target.tabs.filter((t) => t !== tab.docId)
    const slot = Math.max(0, Math.min(index > at ? index - 1 : index, tabs.length))
    tabs.splice(slot, 0, tab.docId)
    return { panes: panes.map((p) => (p.id === to ? { ...p, tabs, active: tab.docId } : p)), focus: to }
  }
  // Already open in the target: it just moves within that strip.
  const existing = target.tabs.indexOf(tab.docId)
  const tabs = target.tabs.filter((t) => t !== tab.docId)
  const slot = Math.max(0, Math.min(existing !== -1 && index > existing ? index - 1 : index, tabs.length))
  tabs.splice(slot, 0, tab.docId)
  const placed = panes.map((p) => (p.id === to ? { ...p, tabs, active: tab.docId } : p))
  return { panes: removeTab(placed, tab.from, tab.docId), focus: to }
}

// Onto a pane's edge: a new pane there holding the tab.
export function splitWithTab(panes: PaneLayout[], tab: DraggedTab, target: string, edge: Edge, newId: string): LayoutResult | null {
  const source = tab.from === null ? null : panes.find((p) => p.id === tab.from)
  if (source === undefined || !panes.some((p) => p.id === target)) return null
  // Its own pane's edge, when it's the pane's only tab: nothing would change.
  if (source && tab.from === target && source.tabs.length === 1) return null
  const rest = removeTab(panes, tab.from, tab.docId)
  const next = insertPane(rest, target, edge, { id: newId, tabs: [tab.docId], active: tab.docId })
  return next && { panes: next, focus: newId }
}

// Whether a drop on `target`'s edge could open a pane there.
export function canSplit(panes: PaneLayout[], tab: DraggedTab, target: string, edge: Edge = 'right'): boolean {
  return splitWithTab(panes, tab, target, edge, '?') !== null
}
