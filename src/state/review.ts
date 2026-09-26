import { create } from 'zustand'
import { openContent } from '@/editor/sessions'
import { db, type ReviewSession } from '@/lib/db'
import { getDocument } from '@/lib/documents'
import { getSettings } from '@/lib/settings'
import { decide as decideFlag, reopen as reopenFlag, type Decision } from '@/review/model'
import { ReviewRequestError } from '@/review/openrouter'
import { produceReview, reanchor } from '@/review/pipeline'
import { useWorkspace } from './workspace'

// AI Style Review state: which documents are being reviewed or failed,
// which pane shows a review, the open flag, and the key panel.

export type RunState = { state: 'running'; startedAt: number } | { state: 'error'; code: string; message: string }

interface ReviewState {
  runs: Record<string, RunState>
  sessions: Record<string, ReviewSession>
  // paneId → documentId: panes currently showing a review.
  openIn: Record<string, string>
  activeFlag: string | null
  logOpen: boolean
  keyPanel: { open: boolean; reason: 'cell' | 'review'; documentId?: string }
  keyTesting: boolean

  loadSession(documentId: string): Promise<ReviewSession | undefined>
  requestReview(documentId: string): Promise<void>
  run(documentId: string): Promise<void>
  dismissError(documentId: string): void
  decide(documentId: string, key: string, decision: Decision, userText?: string): void
  reopen(documentId: string, key: string): void
  closeReview(paneId: string): void
  discardSession(documentId: string): Promise<void>
  setActiveFlag(key: string | null): void
  toggleLog(): void
  openKeyPanel(reason: 'cell' | 'review', documentId?: string): void
  closeKeyPanel(): void
  setKeyTesting(v: boolean): void
}

const liveText = async (documentId: string) => openContent(documentId) ?? (await getDocument(documentId))?.content ?? ''

let controllers: Record<string, AbortController> = {}

export const useReview = create<ReviewState>()((set, get) => ({
  runs: {},
  sessions: {},
  openIn: {},
  activeFlag: null,
  logOpen: false,
  keyPanel: { open: false, reason: 'cell' },
  keyTesting: false,

  async loadSession(documentId) {
    const cached = get().sessions[documentId]
    if (cached) return cached
    const stored = await db.reviewSessions.get(documentId)
    if (stored) set({ sessions: { ...get().sessions, [documentId]: stored } })
    return stored
  },

  // The review control. An existing (undecided) session resumes — PRD §7:
  // leaving a review never discards it. With no usable key, the key panel
  // opens instead of a request (T5.2, 7b).
  async requestReview(documentId) {
    if (get().runs[documentId]?.state === 'running') return
    const existing = await get().loadSession(documentId)
    if (existing) {
      const text = await liveText(documentId)
      const session = reanchor(existing, text)
      if (session !== existing) void db.reviewSessions.put(session)
      set({ sessions: { ...get().sessions, [documentId]: session } })
      openHere(documentId)
      return
    }
    const settings = await getSettings()
    if (!settings.openRouterApiKey || settings.keyStatus === 'invalid') {
      get().openKeyPanel('review', documentId)
      return
    }
    await get().run(documentId)
  },

  // Editing continues while a review runs; nothing blocks (2f).
  async run(documentId) {
    const settings = await getSettings()
    if (!settings.openRouterApiKey) return get().openKeyPanel('review', documentId)
    controllers[documentId]?.abort()
    const ctrl = new AbortController()
    controllers[documentId] = ctrl
    set({ runs: { ...get().runs, [documentId]: { state: 'running', startedAt: Date.now() } } })
    try {
      const text = await liveText(documentId)
      const session = await produceReview(documentId, text, settings.openRouterApiKey, ctrl.signal)
      // The document may have been edited while the call ran; anchor the
      // flags to what it says now.
      const now = reanchor(session, await liveText(documentId))
      await db.reviewSessions.put(now)
      const { [documentId]: _done, ...runs } = get().runs
      void _done
      set({ runs, sessions: { ...get().sessions, [documentId]: now } })
      openHere(documentId)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const code = e instanceof ReviewRequestError ? String(e.status === 'network' ? 'offline' : e.status) : 'error'
      set({ runs: { ...get().runs, [documentId]: { state: 'error', code, message: (e as Error).message } } })
    } finally {
      if (controllers[documentId] === ctrl) delete controllers[documentId]
    }
  },

  dismissError(documentId) {
    const { [documentId]: _gone, ...runs } = get().runs
    void _gone
    set({ runs })
  },

  // Every decision persists immediately, so a review left undecided is
  // resumable exactly as it was (PRD §7).
  decide(documentId, key, decision, userText) {
    const s = get().sessions[documentId]
    if (!s) return
    const next = { ...s, flags: decideFlag(s.flags, key, decision, userText) }
    set({ sessions: { ...get().sessions, [documentId]: next }, activeFlag: null })
    void db.reviewSessions.put(next)
  },

  reopen(documentId, key) {
    const s = get().sessions[documentId]
    if (!s) return
    const next = { ...s, flags: reopenFlag(s.flags, key) }
    set({ sessions: { ...get().sessions, [documentId]: next } })
    void db.reviewSessions.put(next)
  },

  // Closing the view keeps the session: undecided flags survive for later.
  closeReview(paneId) {
    const { [paneId]: _closed, ...openIn } = get().openIn
    void _closed
    set({ openIn, activeFlag: null })
  },

  async discardSession(documentId) {
    const { [documentId]: _s, ...sessions } = get().sessions
    void _s
    const openIn = Object.fromEntries(Object.entries(get().openIn).filter(([, d]) => d !== documentId))
    set({ sessions, openIn, activeFlag: null })
    await db.reviewSessions.delete(documentId)
  },

  setActiveFlag: (key) => set({ activeFlag: key }),
  toggleLog: () => set({ logOpen: !get().logOpen }),
  openKeyPanel: (reason, documentId) => set({ keyPanel: { open: true, reason, documentId } }),
  closeKeyPanel: () => set({ keyPanel: { open: false, reason: 'cell' } }),
  setKeyTesting: (v) => set({ keyTesting: v }),
}))

// Shows the review in the pane where the document is focused (or the first
// pane showing it), opening the document there if needed.
function openHere(documentId: string) {
  const ws = useWorkspace.getState()
  const focused = ws.panes.find((p) => p.id === ws.focusedPaneId)
  const pane = focused?.active === documentId ? focused : (ws.panes.find((p) => p.active === documentId) ?? focused)
  if (!pane) return
  if (pane.active !== documentId) ws.openDocument(documentId, { paneId: pane.id })
  const s = useReview.getState()
  useReview.setState({ openIn: { ...s.openIn, [pane.id]: documentId }, activeFlag: null })
}

// A document is locked for editing — in every pane — while any review view
// of it is open (interaction spec §1).
export const isLocked = (openIn: Record<string, string>, documentId: string) => Object.values(openIn).includes(documentId)
