import Dexie, { type EntityTable } from 'dexie'

// IndexedDB is the only persistence layer (ADR-003). Record shapes follow
// PRD §5; the CRUD and store logic on top of them land in Phase 1.

export type TagColor = 1 | 2 | 3 | 4 | 5 | 6

export interface JotDocument {
  id: string
  title: string
  content: string
  color: TagColor | null
  pinned: boolean
  createdAt: number
  updatedAt: number
  // Text direction (Farsi support): auto, by block — or forced for the
  // whole document. Missing means auto.
  dir?: 'auto' | 'ltr' | 'rtl'
  // The title follows the first line (lib/autoTitle.ts) until the person
  // renames it. Set on new documents only; missing means a fixed title.
  autoTitle?: boolean
}

export type KeyStatus = 'untested' | 'valid' | 'invalid' | 'offline'

// A key (Google Cloud Translation's) and what its last test said.
export interface ProviderKey {
  key: string | null
  status: KeyStatus
  lastValidatedAt: number | null
}

export interface Settings {
  id: 'settings'
  theme: 'light' | 'dark' | 'system'
  // The editor's minimap (Phase 8); on unless turned off.
  minimap: boolean
  // Where the rendered view opens: a new tab in the same pane (the default)
  // or a split beside it.
  renderIn?: 'tab' | 'split'
  // Animations (round 4, motion spec); on unless turned off. The system's
  // reduced-motion request turns them off regardless.
  animations?: boolean
  // Auto-fix spelling behind the cursor (Phase 16); off unless turned on.
  autofix?: boolean
  // The person's own keyboard shortcuts (round 4): command id → keys, an
  // empty list for none. Missing commands keep their defaults
  // (state/commands.ts).
  shortcuts?: Record<string, string[]>
  // A Google Cloud Translation key, for translating a selection (Phase 16);
  // no AI involved.
  translateKey?: ProviderKey
  // First run (Phase 10): when the welcome document was created (or the
  // workspace was found already in use), and which document it is.
  welcomedAt: number | null
  welcomeDocId: string | null
  // When the storage warning (Safari / iPad) was last dismissed; it returns
  // 7 days later.
  storageWarningDismissedAt?: number | null
  // The PDF options card's last choices (lib/pdfOptions.ts), one set for
  // every document.
  pdf?: import('./pdfOptions').PdfOptions
}

// Shell layout, restored on reload: which documents are open where, plus
// sidebar preferences. UI state only — nothing here is document content.
export interface PaneLayout {
  id: string
  tabs: string[]
  active: string | null
  // Only in layouts saved before rendered views became tabs ("render:" +
  // document id, state/layout.ts); converted on load.
  render?: boolean
  // The grid (Phase 13, state/layout.ts): panes are listed column by
  // column; a pane marked `below` sits under the one before it, in the same
  // column. On a column's top pane: `size`, the column's width relative to
  // the others (default 1), and `split`, the top pane's share of the
  // column's height when it has a pane below (default 0.5).
  below?: boolean
  size?: number
  split?: number
}

export interface Workspace {
  id: 'workspace'
  panes: PaneLayout[]
  focusedPaneId: string
  sidebarWidth: number
  // Absent in layouts saved before the sidebar could collapse: open.
  sidebarOpen?: boolean
  sort: 'date' | 'name'
}

// A comparison in a diff tab (diff checker; design in docs/design/
// diff-checker/). Each side is a document — edits there are the document's
// own — or pasted scratch text, or empty. It lives as long as its tab.
export type DiffSide = { kind: 'empty' } | { kind: 'doc'; docId: string } | { kind: 'paste'; text: string }

export interface Comparison {
  id: string
  left: DiffSide
  right: DiffSide
  // input: filling the two sides; result: the diff.
  stage: 'input' | 'result'
  layout: 'split' | 'unified'
  hideUnchanged: boolean
  ignoreWhitespace: boolean
  precision: 'word' | 'char'
  createdAt: number
}

// A highlight, underline or note on a stretch of a document (round 4,
// frames 6–7): kept beside the document, never in its markdown. Positions
// follow the text as it's edited (editor/annotations.ts); `quote` is the
// text it was on, to find it again if the text changed elsewhere.
export interface Annotation {
  id: string
  documentId: string
  kind: 'highlight' | 'underline' | 'note'
  // Highlights: one of the three washes (--hl-1…3).
  color?: 1 | 2 | 3
  from: number
  to: number
  quote: string
  // Notes: what the note says.
  body?: string
  createdAt: number
  updatedAt: number
}

export const db = new Dexie('jot') as Dexie & {
  documents: EntityTable<JotDocument, 'id'>
  settings: EntityTable<Settings, 'id'>
  workspace: EntityTable<Workspace, 'id'>
  comparisons: EntityTable<Comparison, 'id'>
  annotations: EntityTable<Annotation, 'id'>
}

db.version(1).stores({
  documents: 'id, updatedAt',
  settings: 'id',
  reviewSessions: 'documentId',
})

db.version(2).stores({
  workspace: 'id',
})

// Phase 12 moved AI provider keys into one map; they're gone since (v7).
db.version(3).stores({})

// The diff checker's comparisons, one per diff tab.
db.version(4).stores({
  comparisons: 'id',
})

// Highlights, underlines and notes (Phase 16).
db.version(5).stores({
  annotations: 'id, documentId',
})

// AI mode's chats, one per document (Phase 17).
db.version(6).stores({
  chats: 'documentId',
})

// The AI suite is removed (2026-11; the code is parked on the parked/ai
// branch): its tables go, and with them the review sessions and chats; AI
// notes and the provider keys and models go from what's kept.
db.version(7)
  .stores({ reviewSessions: null, chats: null })
  .upgrade(async (tx) => {
    await tx.table('annotations').filter((a) => a.kind === 'ai-note').delete()
    await tx.table('settings').toCollection().modify((s: Record<string, unknown>) => {
      delete s.provider
      delete s.keys
      delete s.models
    })
  })
