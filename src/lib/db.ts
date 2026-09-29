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
}

export type Provider = 'openrouter' | 'google'
export type KeyStatus = 'untested' | 'valid' | 'invalid' | 'offline'

export interface Settings {
  id: 'settings'
  // The AI provider reviews run on (ADR-004 amendment). Each provider keeps
  // its own key, so switching back and forth never loses one.
  provider: Provider
  openRouterApiKey: string | null
  keyStatus: KeyStatus
  lastValidatedAt: number | null
  googleApiKey: string | null
  googleKeyStatus: KeyStatus
  googleLastValidatedAt: number | null
  theme: 'light' | 'dark' | 'system'
  // The editor's minimap (Phase 8); on unless turned off.
  minimap: boolean
}

export type FlagFamily = 'tier1' | 'tier1b' | 'tier2' | 'spelling' | 'grammar' | 'punctuation'
export type FlagKind = 'replace' | 'delete' | 'insert' | 'flag'
export type FlagStatus = 'pending' | 'accepted' | 'rejected' | 'ignored' | 'dismissed' | 'edited'

export interface ReviewFlag {
  // Unique per record: aggregate rules emit several flags sharing one rule id.
  key: string
  // Rule id (T1-01…T1-12, T1b-01…T1b-06, T2-01…T2-08) or proofing id (SPL-/GRM-/PNC-).
  id: string
  family: FlagFamily
  kind: FlagKind
  // Anchors into the review's source text. Both null for a comment-only
  // note: a model quote that didn't match the document.
  spanStart: number | null
  spanEnd: number | null
  before: string
  after: string | null
  rationale: string
  status: FlagStatus
  userText?: string
}

export interface ReviewSession {
  documentId: string
  rulesetVersion: string
  model: string
  // The document text the flags anchor into. Editing is locked while the
  // review is open; a resumed review whose document changed since is
  // re-anchored against the new text.
  source: string
  createdAt: number
  flags: ReviewFlag[]
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
}

export interface Workspace {
  id: 'workspace'
  panes: PaneLayout[]
  focusedPaneId: string
  sidebarWidth: number
  sort: 'date' | 'name'
}

export const db = new Dexie('jot') as Dexie & {
  documents: EntityTable<JotDocument, 'id'>
  settings: EntityTable<Settings, 'id'>
  reviewSessions: EntityTable<ReviewSession, 'documentId'>
  workspace: EntityTable<Workspace, 'id'>
}

db.version(1).stores({
  documents: 'id, updatedAt',
  settings: 'id',
  reviewSessions: 'documentId',
})

db.version(2).stores({
  workspace: 'id',
})
