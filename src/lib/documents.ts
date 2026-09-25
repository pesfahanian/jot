import { db, type JotDocument } from './db'

// Document CRUD against IndexedDB (PRD §5). Deletion here is the hard
// delete; the undo-toast flow in T3.5 sits on top of it.

export type DocumentPatch = Partial<Pick<JotDocument, 'title' | 'content' | 'color' | 'pinned'>>

export async function createDocument(init: DocumentPatch = {}): Promise<JotDocument> {
  const now = Date.now()
  const doc: JotDocument = {
    id: crypto.randomUUID(),
    title: init.title ?? 'untitled',
    content: init.content ?? '',
    color: init.color ?? null,
    pinned: init.pinned ?? false,
    createdAt: now,
    updatedAt: now,
  }
  await db.documents.add(doc)
  return doc
}

export function getDocument(id: string): Promise<JotDocument | undefined> {
  return db.documents.get(id)
}

export function listDocuments(): Promise<JotDocument[]> {
  return db.documents.toArray()
}

// Resolves to false when the document no longer exists.
export async function updateDocument(id: string, patch: DocumentPatch): Promise<boolean> {
  const changed = await db.documents.update(id, { ...patch, updatedAt: Date.now() })
  return changed === 1
}

export function deleteDocument(id: string): Promise<void> {
  return db.documents.delete(id)
}

// Re-inserts a deleted document exactly as it was, for undo.
export async function restoreDocument(doc: JotDocument): Promise<void> {
  await db.documents.put(doc)
}
