import { create } from 'zustand'
import { db, type JotDocument, type PaneLayout, type TagColor, type Workspace } from '@/lib/db'
import type { SortMode } from '@/lib/docList'

// Shell state: panes and their tabs, which pane has focus, and the sidebar's
// own controls. Document records live in IndexedDB and are read live; this
// store only holds ids.

export const MAX_PANES = 3
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

  hydrate(ws: Workspace | undefined, docs: JotDocument[]): void
  openDocument(documentId: string, opts?: { paneId?: string; line?: number }): void
  activateTab(paneId: string, documentId: string): void
  closeTab(paneId: string, documentId: string): void
  focusPane(paneId: string): void
  splitRight(): void
  toggleRender(): void
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

  // Restores the saved layout, dropping tabs whose documents no longer
  // exist. With nothing saved, opens the most recently edited document.
  hydrate(ws, docs) {
    const ids = new Set(docs.map((d) => d.id))
    let panes: PaneLayout[] = (ws?.panes ?? [])
      .map((p) => {
        const tabs = p.tabs.filter((t) => ids.has(t))
        return { ...p, tabs, active: p.active && tabs.includes(p.active) ? p.active : (tabs[0] ?? null) }
      })
      .filter((p) => p.tabs.length > 0)
      .slice(0, MAX_PANES)
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
    let { panes } = get()
    let paneId = opts?.paneId ?? get().focusedPaneId
    // A rendered pane only ever shows its own document: opening goes to the
    // nearest editor pane on its left (or right), or a new one if none is left.
    const at = panes.findIndex((p) => p.id === paneId)
    if (panes[at]?.render) {
      const editor = [...panes.slice(0, at)].reverse().find((p) => !p.render) ?? panes.slice(at + 1).find((p) => !p.render)
      if (editor) paneId = editor.id
      else {
        const pane: PaneLayout = { id: newPaneId(), tabs: [], active: null }
        panes = [...panes.slice(0, at), pane, ...panes.slice(at)]
        paneId = pane.id
      }
    }
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
    const next: PaneLayout[] = []
    for (const p of panes) {
      if (p.id !== paneId) {
        next.push(p)
        continue
      }
      const i = p.tabs.indexOf(documentId)
      if (i === -1) {
        next.push(p)
        continue
      }
      const tabs = p.tabs.filter((t) => t !== documentId)
      if (tabs.length === 0 && panes.length > 1) continue
      const active = p.active === documentId ? (tabs[Math.min(i, tabs.length - 1)] ?? null) : p.active
      next.push({ ...p, tabs, active })
    }
    const focus = next.some((p) => p.id === focusedPaneId) ? focusedPaneId : next[Math.max(0, panes.findIndex((p) => p.id === paneId) - 1)].id
    set({ panes: next, focusedPaneId: focus })
  },

  focusPane(paneId) {
    if (get().focusedPaneId !== paneId) set({ focusedPaneId: paneId })
  },

  // Split opens the current document in a new pane to the right of the
  // focused one (6f), up to three editors.
  splitRight() {
    const { panes, focusedPaneId } = get()
    if (panes.length >= MAX_PANES) return
    const i = panes.findIndex((p) => p.id === focusedPaneId)
    if (panes[i]?.render) return
    const current = panes[i]?.active
    if (!current) return
    const pane: PaneLayout = { id: newPaneId(), tabs: [current], active: current }
    set({ panes: [...panes.slice(0, i + 1), pane, ...panes.slice(i + 1)], focusedPaneId: pane.id })
  },

  // Render (2g): the focused editor's document opens rendered in a pane to
  // its right; pressed again, that rendered pane closes. Counts toward the
  // three-pane limit. Focus stays on the editor.
  toggleRender() {
    const { panes, focusedPaneId } = get()
    const i = panes.findIndex((p) => p.id === focusedPaneId)
    const doc = panes[i]?.active
    if (!doc || panes[i].render) return
    if (panes.some((p) => p.render && p.active === doc)) {
      set({ panes: panes.filter((p) => !(p.render && p.active === doc)) })
      return
    }
    if (panes.length >= MAX_PANES) return
    const pane: PaneLayout = { id: newPaneId(), tabs: [doc], active: doc, render: true }
    set({ panes: [...panes.slice(0, i + 1), pane, ...panes.slice(i + 1)] })
  },

  closeDocumentEverywhere(documentId) {
    const placements: DeletedEntry['placements'] = []
    for (const p of get().panes) {
      const index = p.tabs.indexOf(documentId)
      if (index !== -1) placements.push({ paneId: p.id, index, wasActive: p.active === documentId })
    }
    for (const pl of placements) get().closeTab(pl.paneId, documentId)
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

export function focusedPane(s: Pick<WorkspaceState, 'panes' | 'focusedPaneId'>): PaneLayout | undefined {
  return s.panes.find((p) => p.id === s.focusedPaneId)
}
