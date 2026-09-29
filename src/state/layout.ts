import type { PaneLayout } from '@/lib/db'

// Tab drag (Phase 8, part A) as pure layout moves, so they're testable
// without the UI: reorder within a strip, move to another pane's strip, or
// drop on a pane's left/right edge to open it in a new column there. A tab
// moves — it leaves where it came from, and a pane left empty closes (6f).
// The three-pane limit holds.

export const MAX_COLUMNS = 3

// A tab is a document's editor (its id) or its rendered view ("render:" +
// id) — an ordinary tab, as VSCode's preview is, so every tab move applies.
const RENDER = 'render:'
export const renderTab = (docId: string) => RENDER + docId
export const isRenderTab = (tabId: string | null | undefined) => !!tabId?.startsWith(RENDER)
export const docIdOf = (tabId: string) => (tabId.startsWith(RENDER) ? tabId.slice(RENDER.length) : tabId)

export interface DraggedTab {
  // The tab's id: a document id, or a rendered view's "render:" id.
  docId: string
  from: string
}

export interface LayoutResult {
  panes: PaneLayout[]
  focus: string
}

// Takes a tab out of a pane: its neighbour becomes active, and a pane left
// empty closes unless it's the only one.
function removeTab(panes: PaneLayout[], paneId: string, docId: string): PaneLayout[] {
  return panes.flatMap((p) => {
    if (p.id !== paneId) return [p]
    const i = p.tabs.indexOf(docId)
    if (i === -1) return [p]
    const tabs = p.tabs.filter((t) => t !== docId)
    if (tabs.length === 0 && panes.length > 1) return []
    const active = p.active === docId ? (tabs[Math.min(i, tabs.length - 1)] ?? null) : p.active
    return [{ ...p, tabs, active }]
  })
}

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

// Onto a pane's left or right edge: a new column beside it holding the tab.
export function splitWithTab(panes: PaneLayout[], tab: DraggedTab, target: string, side: 'left' | 'right', newId: string): LayoutResult | null {
  const source = panes.find((p) => p.id === tab.from)
  const onto = panes.find((p) => p.id === target)
  if (!source || !onto) return null
  // Its own pane's edge, when it's the pane's only tab: nothing would change.
  if (tab.from === target && source.tabs.length === 1) return null
  const rest = removeTab(panes, tab.from, tab.docId)
  if (rest.length >= MAX_COLUMNS) return null
  const i = rest.findIndex((p) => p.id === target)
  if (i === -1) return null
  const pane: PaneLayout = { id: newId, tabs: [tab.docId], active: tab.docId }
  const at = side === 'left' ? i : i + 1
  return { panes: [...rest.slice(0, at), pane, ...rest.slice(at)], focus: newId }
}

// Whether a drop on `target`'s edge could open a new column.
export function canSplit(panes: PaneLayout[], tab: DraggedTab, target: string): boolean {
  return splitWithTab(panes, tab, target, 'right', '?') !== null
}
