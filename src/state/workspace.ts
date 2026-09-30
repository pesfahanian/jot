import { create } from 'zustand'
import { db, type JotDocument, type PaneLayout, type TagColor, type Workspace } from '@/lib/db'
import type { SortMode } from '@/lib/docList'
import { columnsOf, docIdOf, insertPane, MAX_COLUMNS, MAX_PANES, moveTab, removePane, renderTab, resize, splitWithTab, tidy, type DraggedTab, type Edge } from './layout'

// Shell state: panes and their tabs, which pane has focus, and the sidebar's
// own controls. Document records live in IndexedDB and are read live; this
// store only holds ids.

export { MAX_PANES }
export const SIDEBAR_MIN = 180
export const SIDEBAR_MAX = 460
export const SIDEBAR_DEFAULT = 248

export interface CursorStatus {
  documentId: string
  line: number
  col: number
}

export interface DeletedEntry {
  doc: JotDocument
  // Where it was open, so undo can put the tabs back.
  placements: { paneId: string; index: number; wasActive: boolean }[]
}

export type Toast =
  | { kind: 'deleted'; id: number; entry: DeletedEntry }
  // After Apply (6c): how much text moved, with undo as one editor step.
  | { kind: 'applied'; id: number; documentId: string; changed: number; kept: number }

interface WorkspaceState {
  loaded: boolean
  panes: PaneLayout[]
  focusedPaneId: string
  sidebarWidth: number
  sort: SortMode
  colorFilter: ReadonlySet<TagColor>
  searchOpen: boolean
  searchQuery: string
  renamingId: string | null
  cursor: CursorStatus | null
  // A pending "move the cursor here" for a document, e.g. from a search hit.
  reveal: { documentId: string; line: number; nonce: number } | null
  toast: Toast | null
  // The tab being dragged (Phase 8), while a drag is in flight: panes show
  // their drop zones from it.
  dragTab: DraggedTab | null

  hydrate(ws: Workspace | undefined, docs: JotDocument[]): void
  openDocument(documentId: string, opts?: { paneId?: string; line?: number }): void
  activateTab(paneId: string, documentId: string): void
  closeTab(paneId: string, documentId: string): void
  focusPane(paneId: string): void
  split(): void
  toggleRender(): void
  setDragTab(tab: DraggedTab | null): void
  dropTabOnStrip(to: string, index: number): void
  dropTabOnEdge(target: string, side: Edge | 'center'): void
  resizePanes(sizes: Record<string, { size?: number; split?: number }>): void
  closeDocumentEverywhere(documentId: string): DeletedEntry['placements']
  restorePlacements(documentId: string, placements: DeletedEntry['placements']): void
  setSidebarWidth(px: number): void
  toggleSort(): void
  toggleColor(color: TagColor): void
  clearColorFilter(): void
  setSearch(open: boolean, query?: string): void
  setRenaming(id: string | null): void
  setCursor(c: CursorStatus | null): void
  showToast(t: Toast | null): void
}

let paneSeq = 0
const newPaneId = () => `pane-${Date.now().toString(36)}-${paneSeq++}`

const clampWidth = (px: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(px)))

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  loaded: false,
  panes: [],
  focusedPaneId: '',
  sidebarWidth: SIDEBAR_DEFAULT,
  sort: 'date',
  colorFilter: new Set(),
  searchOpen: false,
  searchQuery: '',
  renamingId: null,
  cursor: null,
  reveal: null,
  toast: null,
  dragTab: null,

  // Restores the saved layout, dropping tabs whose documents no longer
  // exist. With nothing saved, opens the most recently edited document.
  // Layouts saved before rendered views became tabs had whole "render"
  // panes; those become panes of rendered tabs.
  hydrate(ws, docs) {
    const ids = new Set(docs.map((d) => d.id))
    let panes: PaneLayout[] = (ws?.panes ?? [])
      .map(({ render, ...p }) => (render ? { ...p, tabs: p.tabs.map(renderTab), active: p.active && renderTab(p.active) } : p))
      .map((p) => {
        const tabs = p.tabs.filter((t) => ids.has(docIdOf(t)))
        return { ...p, tabs, active: p.active && tabs.includes(p.active) ? p.active : (tabs[0] ?? null) }
      })
    // Panes left empty close the way a closed pane does, so the grid holds.
    for (const p of panes) if (p.tabs.length === 0) panes = removePane(panes, p.id)
    panes = tidy(panes)
    if (panes.length === 0) {
      const recent = docs.reduce<JotDocument | null>((a, b) => (!a || b.updatedAt > a.updatedAt ? b : a), null)
      panes = [{ id: newPaneId(), tabs: recent ? [recent.id] : [], active: recent?.id ?? null }]
    }
    const focusedPaneId = panes.some((p) => p.id === ws?.focusedPaneId) ? ws!.focusedPaneId : panes[0].id
    set({
      loaded: true,
      panes,
      focusedPaneId,
      sidebarWidth: clampWidth(ws?.sidebarWidth ?? SIDEBAR_DEFAULT),
      sort: ws?.sort ?? 'date',
    })
  },

  // Opens in the focused pane (or the given one): activates the tab if it's
  // already there, otherwise inserts it right after the active tab.
  openDocument(documentId, opts) {
    const { panes } = get()
    const paneId = opts?.paneId ?? get().focusedPaneId
    set({
      panes: panes.map((p) => {
        if (p.id !== paneId) return p
        if (p.tabs.includes(documentId)) return { ...p, active: documentId }
        const at = p.active ? p.tabs.indexOf(p.active) + 1 : p.tabs.length
        const tabs = [...p.tabs.slice(0, at), documentId, ...p.tabs.slice(at)]
        return { ...p, tabs, active: documentId }
      }),
      focusedPaneId: paneId,
      reveal: opts?.line ? { documentId, line: opts.line, nonce: Date.now() } : get().reveal,
    })
  },

  activateTab(paneId, documentId) {
    set({ panes: get().panes.map((p) => (p.id === paneId ? { ...p, active: documentId } : p)), focusedPaneId: paneId })
  },

  // Closing a tab activates its neighbour. Closing the last tab closes the
  // pane (6f) — unless it's the only pane, which stays, empty.
  closeTab(paneId, documentId) {
    const { panes, focusedPaneId } = get()
    const p = panes.find((q) => q.id === paneId)
    const i = p ? p.tabs.indexOf(documentId) : -1
    if (!p || i === -1) return
    const tabs = p.tabs.filter((t) => t !== documentId)
    const active = p.active === documentId ? (tabs[Math.min(i, tabs.length - 1)] ?? null) : p.active
    const next = tabs.length === 0 && panes.length > 1 ? removePane(panes, paneId) : panes.map((q) => (q.id === paneId ? { ...q, tabs, active } : q))
    const focus = next.some((p) => p.id === focusedPaneId) ? focusedPaneId : next[Math.max(0, panes.findIndex((p) => p.id === paneId) - 1)].id
    set({ panes: next, focusedPaneId: focus })
  },

  focusPane(paneId) {
    if (get().focusedPaneId !== paneId) set({ focusedPaneId: paneId })
  },

  // Split opens the current document in a new pane (6f): a new column to
  // the right while there's room for one, else below, in its own column.
  split() {
    const { panes, focusedPaneId } = get()
    const current = panes.find((p) => p.id === focusedPaneId)?.active
    const edge = splitEdge(panes, focusedPaneId)
    if (!current || !edge) return
    const pane: PaneLayout = { id: newPaneId(), tabs: [current], active: current }
    const next = insertPane(panes, focusedPaneId, edge, pane)
    if (next) set({ panes: next, focusedPaneId: pane.id })
  },

  // Render (2g, Cmd/Ctrl+Shift+V) toggles the focused document's rendered
  // view — a tab ("render:" + id), movable like any other. Opening puts it in
  // a new pane where split would (right, else below), or, with no room, as a
  // tab in the neighbouring pane; focus stays put. Pressed again, from the editor or
  // the rendered tab, every rendered tab of that document closes.
  toggleRender() {
    const { panes, focusedPaneId } = get()
    const i = panes.findIndex((p) => p.id === focusedPaneId)
    const active = panes[i]?.active
    if (!active) return
    const rid = renderTab(docIdOf(active))
    if (panes.some((p) => p.tabs.includes(rid))) {
      for (const p of get().panes) if (p.tabs.includes(rid)) get().closeTab(p.id, rid)
      return
    }
    const edge = splitEdge(panes, focusedPaneId)
    const next = edge && insertPane(panes, focusedPaneId, edge, { id: newPaneId(), tabs: [rid], active: rid })
    if (next) return set({ panes: next })
    const j = i + 1 < panes.length ? i + 1 : i - 1
    set({
      panes: panes.map((p, k) => {
        if (k !== j) return p
        const at = p.active ? p.tabs.indexOf(p.active) + 1 : p.tabs.length
        return { ...p, tabs: [...p.tabs.slice(0, at), rid, ...p.tabs.slice(at)], active: rid }
      }),
    })
  },

  setDragTab: (tab) => set({ dragTab: tab }),

  dropTabOnStrip(to, index) {
    const tab = get().dragTab
    if (!tab) return
    const r = moveTab(get().panes, tab, to, index)
    set(r ? { panes: r.panes, focusedPaneId: r.focus, dragTab: null } : { dragTab: null })
  },

  // A pane's left/right edge opens a new column beside it, its top/bottom
  // edge a pane stacked in its column; its middle takes the tab into that
  // pane's strip, at the end.
  dropTabOnEdge(target, side) {
    const tab = get().dragTab
    if (!tab) return
    // Its own pane's middle: nothing to do.
    if (side === 'center' && tab.from === target) return set({ dragTab: null })
    const panes = get().panes
    const r =
      side === 'center'
        ? moveTab(panes, tab, target, panes.find((p) => p.id === target)?.tabs.length ?? 0)
        : splitWithTab(panes, tab, target, side, newPaneId())
    set(r ? { panes: r.panes, focusedPaneId: r.focus, dragTab: null } : { dragTab: null })
  },

  resizePanes: (sizes) => set({ panes: resize(get().panes, sizes) }),

  closeDocumentEverywhere(documentId) {
    const placements: DeletedEntry['placements'] = []
    for (const p of get().panes) {
      const index = p.tabs.indexOf(documentId)
      if (index !== -1) placements.push({ paneId: p.id, index, wasActive: p.active === documentId })
    }
    for (const pl of placements) get().closeTab(pl.paneId, documentId)
    // Its rendered views go too (undo restores the editor tabs only).
    const rid = renderTab(documentId)
    for (const p of get().panes) if (p.tabs.includes(rid)) get().closeTab(p.id, rid)
    return placements
  },

  // Undo of a delete: put the tabs back where they were, as far as the
  // panes still exist; otherwise open it in the focused pane.
  restorePlacements(documentId, placements) {
    let panes = get().panes
    let placed = false
    for (const pl of placements) {
      panes = panes.map((p) => {
        if (p.id !== pl.paneId || p.tabs.includes(documentId)) return p
        placed = true
        const tabs = [...p.tabs.slice(0, pl.index), documentId, ...p.tabs.slice(pl.index)]
        return { ...p, tabs, active: pl.wasActive || !p.active ? documentId : p.active }
      })
    }
    set({ panes })
    if (!placed && placements.length) get().openDocument(documentId)
  },

  setSidebarWidth: (px) => set({ sidebarWidth: clampWidth(px) }),
  toggleSort: () => set({ sort: get().sort === 'date' ? 'name' : 'date' }),
  toggleColor(color) {
    const next = new Set(get().colorFilter)
    if (next.has(color)) next.delete(color)
    else next.add(color)
    set({ colorFilter: next })
  },
  clearColorFilter: () => set({ colorFilter: new Set() }),
  setSearch: (open, query) => set({ searchOpen: open, searchQuery: open ? (query ?? get().searchQuery) : '' }),
  setRenaming: (id) => set({ renamingId: id }),
  setCursor: (c) => set({ cursor: c }),
  showToast: (t) => set({ toast: t }),
}))

// Persist the layout whenever it changes. Debounced lightly — this is UI
// state, not document content.
let saveTimer: ReturnType<typeof setTimeout> | undefined
useWorkspace.subscribe((s, prev) => {
  if (!s.loaded) return
  if (s.panes === prev.panes && s.focusedPaneId === prev.focusedPaneId && s.sidebarWidth === prev.sidebarWidth && s.sort === prev.sort) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const { panes, focusedPaneId, sidebarWidth, sort } = useWorkspace.getState()
    void db.workspace.put({ id: 'workspace', panes, focusedPaneId, sidebarWidth, sort })
  }, 200)
})

// Where split (and render) would open a pane beside `paneId`: a new column
// to the right while there's room, else below it when its column has one
// pane; null when the grid is full there.
export function splitEdge(panes: PaneLayout[], paneId: string): Edge | null {
  const cols = columnsOf(panes)
  if (cols.length < MAX_COLUMNS) return 'right'
  return cols.find((c) => c.some((p) => p.id === paneId))?.length === 1 ? 'bottom' : null
}

export function focusedPane(s: Pick<WorkspaceState, 'panes' | 'focusedPaneId'>): PaneLayout | undefined {
  return s.panes.find((p) => p.id === s.focusedPaneId)
}
