import { create } from 'zustand'
import { openContent } from '@/editor/sessions'
import { db, type ReviewSession } from '@/lib/db'
import { getDocument } from '@/lib/documents'
import { getSettings, providerKey } from '@/lib/settings'
import { decide as decideFlag, hasStake, reopen as reopenFlag, standing, type Decision } from '@/review/model'
import { ReviewRequestError } from '@/review/request'
import { PROVIDERS } from '@/review/providers'
import { reanchor } from '@/review/reanchor'
import { useWorkspace } from './workspace'

// AI Style Review state: which documents are being reviewed or failed,
// which pane shows a review, the open flag, and the key panel.

export type RunState =
  | { state: 'running'; startedAt: number }
  // detail: the full response as received, shown in the error panel.
  | { state: 'error'; code: string; message: string; detail: string }

interface ReviewState {
  runs: Record<string, RunState>
  sessions: Record<string, ReviewSession>
  // paneId → documentId: panes currently showing a review.
  openIn: Record<string, string>
  activeFlag: string | null
  logOpen: boolean
  keyPanel: { open: boolean; reason: 'cell' | 'review'; documentId?: string }
  keyTesting: boolean
  // A review that finished while Jot's tab was in the background, until the
  // person comes back — the favicon's done / failed badge (lib/favicon.ts).
  unseen: 'done' | 'failed' | null

  loadSession(documentId: string): Promise<ReviewSession | undefined>
  requestReview(documentId: string): Promise<void>
  resumeReview(documentId: string): Promise<void>
  reviewAgain(documentId: string): Promise<void>
  run(documentId: string): Promise<void>
  cancel(documentId: string): void
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

// A review that hasn't answered in this long is abandoned and reported as
// timed out (retry stays one click away).
export const REVIEW_TIMEOUT_MS = 60_000

export const useReview = create<ReviewState>()((set, get) => ({
  runs: {},
  sessions: {},
  openIn: {},
  activeFlag: null,
  logOpen: false,
  keyPanel: { open: false, reason: 'cell' },
  keyTesting: false,
  unseen: null,

  async loadSession(documentId) {
    const cached = get().sessions[documentId]
    if (cached) return cached
    const stored = await db.reviewSessions.get(documentId)
    if (stored) set({ sessions: { ...get().sessions, [documentId]: stored } })
    return stored
  },

  // The review control. A review of exactly the current text resumes —
  // PRD §7: leaving a review never discards it. Once the text has changed
  // (strict: any change), a review with nothing left to lose is replaced by
  // a fresh one; one that still holds undecided flags or accepted/edited
  // decisions is never replaced silently — the control asks first and calls
  // resumeReview or reviewAgain (open-decisions #23). With no key, the key
  // panel opens instead of a request (T5.2, 7b).
  async requestReview(documentId) {
    if (get().runs[documentId]?.state === 'running') return
    const existing = await get().loadSession(documentId)
    if (existing) {
      const verdict = standing(existing.source, existing.flags, await liveText(documentId))
      if (verdict === 'current') return openHere(documentId)
      if (verdict === 'stale') return
      await get().discardSession(documentId)
    }
    const settings = await getSettings()
    if (!providerKey(settings).key) {
      get().openKeyPanel('review', documentId)
      return
    }
    await get().run(documentId)
  },

  // Resume a review whose text has changed since: flags are re-anchored
  // against the new text, and lost ones become notes (open-decisions #18).
  async resumeReview(documentId) {
    const existing = await get().loadSession(documentId)
    if (!existing) return
    const session = reanchor(existing, await liveText(documentId))
    if (session !== existing) void db.reviewSessions.put(session)
    set({ sessions: { ...get().sessions, [documentId]: session } })
    openHere(documentId)
  },

  async reviewAgain(documentId) {
    await get().discardSession(documentId)
    await get().requestReview(documentId)
  },

  // Editing continues while a review runs; nothing blocks (2f). The run can
  // be cancelled, and gives up on its own after REVIEW_TIMEOUT_MS.
  async run(documentId) {
    const settings = await getSettings()
    const key = providerKey(settings).key
    if (!key) return get().openKeyPanel('review', documentId)
    controllers[documentId]?.abort()
    const ctrl = new AbortController()
    controllers[documentId] = ctrl
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, REVIEW_TIMEOUT_MS)
    set({ runs: { ...get().runs, [documentId]: { state: 'running', startedAt: Date.now() } } })
    try {
      const text = await liveText(documentId)
      // The pipeline (rule set, Pass A/B, prompt) loads on first use only.
      const { produceReview } = await import('@/review/pipeline')
      const session = await produceReview(documentId, text, settings.provider, key, ctrl.signal)
      // The document may have been edited while the call ran; anchor the
      // flags to what it says now.
      const now = reanchor(session, await liveText(documentId))
      await db.reviewSessions.put(now)
      const { [documentId]: _done, ...runs } = get().runs
      void _done
      set({ runs, sessions: { ...get().sessions, [documentId]: now } })
      openHere(documentId)
      noteIfAway('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        // A cancel has already cleared the run; only a timeout reports.
        if (timedOut) {
          noteIfAway('failed')
          set({
            runs: {
              ...get().runs,
              [documentId]: {
                state: 'error',
                code: 'timeout',
                message: `No response within ${REVIEW_TIMEOUT_MS / 1000} seconds`,
                detail: `The request to ${PROVIDERS[settings.provider].label} was abandoned after ${REVIEW_TIMEOUT_MS / 1000} s without an answer. The model or its provider may be queued or slow.`,
              },
            },
          })
        }
        return
      }
      const code = e instanceof ReviewRequestError ? String(e.status === 'network' ? 'offline' : e.status) : 'error'
      const detail = e instanceof ReviewRequestError && e.raw ? e.raw : String((e as Error).stack ?? e)
      set({ runs: { ...get().runs, [documentId]: { state: 'error', code, message: (e as Error).message, detail } } })
      noteIfAway('failed')
    } finally {
      clearTimeout(timer)
      if (controllers[documentId] === ctrl) delete controllers[documentId]
    }
  },

  // Stops a running review: the request is dropped and the control returns
  // to rest. Nothing from the run is kept.
  cancel(documentId) {
    controllers[documentId]?.abort()
    delete controllers[documentId]
    const { [documentId]: _gone, ...runs } = get().runs
    void _gone
    set({ runs })
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

  // Closing the view keeps the session while it holds anything — undecided
  // flags, or decisions that change the text. A review with nothing left
  // (no flags, or only rejections, ignores and dismissals) ends here, so the
  // next click reviews the text afresh.
  closeReview(paneId) {
    const { [paneId]: documentId, ...openIn } = get().openIn
    set({ openIn, activeFlag: null })
    const session = documentId ? get().sessions[documentId] : undefined
    if (session && !hasStake(session.flags) && !Object.values(openIn).includes(documentId)) void get().discardSession(documentId)
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

// Only a result the person didn't see arrive is flagged; failed outranks
// done. Coming back to the tab clears it.
function noteIfAway(outcome: 'done' | 'failed') {
  if (document.visibilityState !== 'hidden') return
  const was = useReview.getState().unseen
  useReview.setState({ unseen: was === 'failed' ? 'failed' : outcome })
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && useReview.getState().unseen) useReview.setState({ unseen: null })
})

// Shows the review in the pane where the document is focused (or the first
// pane showing it), opening the document there if needed.
function openHere(documentId: string) {
  const ws = useWorkspace.getState()
  const focused = ws.panes.find((p) => p.id === ws.focusedPaneId)
  // Never a rendered pane: a review needs the editor underneath it.
  const pane =
    focused?.active === documentId && !focused.render ? focused : (ws.panes.find((p) => p.active === documentId && !p.render) ?? ws.panes.find((p) => !p.render))
  if (!pane) return
  if (pane.active !== documentId) ws.openDocument(documentId, { paneId: pane.id })
  const s = useReview.getState()
  useReview.setState({ openIn: { ...s.openIn, [pane.id]: documentId }, activeFlag: null })
}

// A document is locked for editing — in every pane — while any review view
// of it is open (interaction spec §1).
export const isLocked = (openIn: Record<string, string>, documentId: string) => Object.values(openIn).includes(documentId)
