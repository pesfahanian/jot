import { Annotation, Transaction, type TransactionSpec } from '@codemirror/state'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import { createAutosave, type Autosave } from '@/lib/autosave'

// One session per open document, shared by every pane showing it. Splitting
// opens the current document in a second pane, so two CodeMirror views can
// hold the same text: an edit in one is replayed into the others, and one
// autosave writes it — two independent writers would race each other.

const fromPeer = Annotation.define<boolean>()

type Listener = (content: string) => void

export interface DocumentSession {
  readonly documentId: string
  content: string
  attach(view: EditorView): () => void
  handleUpdate(u: ViewUpdate): void
  subscribe(fn: Listener): () => void
}

const sessions = new Map<string, DocumentSession & { views: Set<EditorView>; autosave: Autosave }>()

export function getSession(documentId: string, initialContent: string): DocumentSession {
  const existing = sessions.get(documentId)
  if (existing) return existing

  const views = new Set<EditorView>()
  const listeners = new Set<Listener>()
  const autosave = createAutosave(documentId)

  const session = {
    documentId,
    content: initialContent,
    views,
    autosave,
    attach(view: EditorView) {
      views.add(view)
      return () => {
        views.delete(view)
        if (views.size === 0) {
          sessions.delete(documentId)
          void autosave.dispose()
        }
      }
    },
    handleUpdate(u: ViewUpdate) {
      if (!u.docChanged) return
      // Replayed edits from a peer are already saved and broadcast.
      if (u.transactions.some((tr) => tr.annotation(fromPeer))) return
      session.content = u.state.doc.toString()
      for (const peer of views) {
        if (peer === u.view) continue
        for (const tr of u.transactions) {
          if (tr.changes.empty) continue
          const spec: TransactionSpec = {
            changes: tr.changes,
            annotations: [fromPeer.of(true), Transaction.addToHistory.of(false)],
          }
          peer.dispatch(spec)
        }
      }
      autosave.write(session.content)
      for (const fn of listeners) fn(session.content)
    },
    subscribe(fn: Listener) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  sessions.set(documentId, session)
  return session
}

// Live text of an open document, or undefined when no pane shows it.
export function openContent(documentId: string): string | undefined {
  return sessions.get(documentId)?.content
}

// The views showing a document — Apply writes through one of them so the
// change is a real editor transaction (one undo step) that syncs to peers.
export function viewsOf(documentId: string): EditorView[] {
  return [...(sessions.get(documentId)?.views ?? [])]
}
