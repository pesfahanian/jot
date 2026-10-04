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

export type Provider = 'openrouter' | 'google' | 'openai' | 'anthropic'
export type KeyStatus = 'untested' | 'valid' | 'invalid' | 'offline'

// One provider's key and what its last test said.
export interface ProviderKey {
  key: string | null
  status: KeyStatus
  lastValidatedAt: number | null
}

export interface Settings {
  id: 'settings'
  // The AI provider reviews run on (ADR-004 amendment). Each provider keeps
  // its own key and its own model chain, so switching back and forth never
  // loses either.
  provider: Provider
  keys: Partial<Record<Provider, ProviderKey>>
  // Per provider: the model reviews run on, then its fallbacks in order
  // (Phase 12). Missing = the provider's default chain.
  models: Partial<Record<Provider, string[]>>
  theme: 'light' | 'dark' | 'system'
  // The editor's minimap (Phase 8); on unless turned off.
  minimap: boolean
  // First run (Phase 10): when the welcome document was created (or the
  // workspace was found already in use), and which document it is.
  welcomedAt: number | null
  welcomeDocId: string | null
  // When the storage warning (Safari / iPad) was last dismissed; it returns
  // 7 days later.
  storageWarningDismissedAt?: number | null
}

export type FlagFamily = 'tier1' | 'tier1b' | 'tier2' | 'spelling' | 'grammar' | 'punctuation'
export type FlagKind = 'replace' | 'delete' | 'insert' | 'flag'
// superseded: set by Jot, not chosen — a pending flag inside a wider flag
// that was accepted or edited (its text is gone; open-decisions #16).
export type FlagStatus = 'pending' | 'accepted' | 'rejected' | 'ignored' | 'dismissed' | 'edited' | 'superseded'

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
  // For a superseded flag: the key of the wider flag that took its text.
  supersededBy?: string
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

// Phase 12: keys move from one field set per provider to a map keyed by
// provider, so adding a provider doesn't add fields.
const LEGACY_KEY_FIELDS = ['openRouterApiKey', 'keyStatus', 'lastValidatedAt', 'googleApiKey', 'googleKeyStatus', 'googleLastValidatedAt']
export function migrateKeys(s: Record<string, unknown>): void {
  const keys: Partial<Record<Provider, ProviderKey>> = {}
  const record = (key: unknown, status: unknown, at: unknown): ProviderKey => ({ key: key as string, status: (status as KeyStatus) ?? 'untested', lastValidatedAt: (at as number) ?? null })
  if (s.openRouterApiKey) keys.openrouter = record(s.openRouterApiKey, s.keyStatus, s.lastValidatedAt)
  if (s.googleApiKey) keys.google = record(s.googleApiKey, s.googleKeyStatus, s.googleLastValidatedAt)
  s.keys = keys
  s.models = {}
  for (const f of LEGACY_KEY_FIELDS) delete s[f]
}

db.version(3)
  .stores({})
  .upgrade((tx) => tx.table('settings').toCollection().modify(migrateKeys))
