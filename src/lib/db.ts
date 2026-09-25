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

export interface Settings {
  id: 'settings'
  openRouterApiKey: string | null
  keyStatus: 'untested' | 'valid' | 'invalid' | 'offline'
  lastValidatedAt: number | null
  theme: 'light' | 'dark' | 'system'
}

export type FlagFamily = 'tier1' | 'tier1b' | 'tier2' | 'spelling' | 'grammar' | 'punctuation'
export type FlagKind = 'replace' | 'delete' | 'insert' | 'flag'
export type FlagStatus = 'pending' | 'accepted' | 'rejected' | 'ignored' | 'dismissed' | 'edited'

export interface ReviewFlag {
  id: string
  family: FlagFamily
  kind: FlagKind
  spanStart: number
  spanEnd: number
  before: string
  after: string
  rationale: string
  status: FlagStatus
  userText?: string
}

export interface ReviewSession {
  documentId: string
  rulesetVersion: string
  flags: ReviewFlag[]
}

export const db = new Dexie('jot') as Dexie & {
  documents: EntityTable<JotDocument, 'id'>
  settings: EntityTable<Settings, 'id'>
  reviewSessions: EntityTable<ReviewSession, 'documentId'>
}

db.version(1).stores({
  documents: 'id, updatedAt',
  settings: 'id',
  reviewSessions: 'documentId',
})

// Console access for the no-UI verification steps (T0.4, T1.1). Dev only.
if (import.meta.env.DEV) {
  ;(window as unknown as { jotDb: typeof db }).jotDb = db
}
