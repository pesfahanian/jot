import type { JotDocument, TagColor } from '@/lib/db'
import { uniqueTitle } from '@/lib/docList'
import { createDocument, deleteDocument, listDocuments, restoreDocument, updateDocument } from '@/lib/documents'
import { useWorkspace } from './workspace'

// Document-level actions shared by the sidebar, tabs and menus.

export const UNDO_WINDOW_MS = 8000

// New-document flow (T3.8): the + button creates "untitled" (or the next
// free "untitled-N"), opens it as a new tab in the focused pane, and puts its
// sidebar row straight into rename. Search's "new document "q"" passes the
// query as the title instead, and skips rename — the name is already chosen.
export async function newDocument(title?: string): Promise<JotDocument> {
  const docs = await listDocuments()
  const doc = await createDocument({ title: title?.trim() || uniqueTitle('untitled', docs) })
  const ws = useWorkspace.getState()
  ws.openDocument(doc.id)
  if (!title) {
    // Its row has to be visible to rename it: an untagged new document would
    // be hidden by an active color filter or an open search.
    ws.clearColorFilter()
    ws.setSearch(false)
    ws.setRenaming(doc.id)
  }
  return doc
}

export async function renameDocument(id: string, title: string): Promise<void> {
  const next = title.trim()
  if (next) await updateDocument(id, { title: next })
}

// One color per document; assigning replaces (ADR-007). null clears it.
export function setColor(id: string, color: TagColor | null): Promise<boolean> {
  return updateDocument(id, { color })
}

export function setPinned(id: string, pinned: boolean): Promise<boolean> {
  return updateDocument(id, { pinned })
}

// Delete with no confirmation (T3.5): the record goes immediately and the
// toast offers undo. A second delete while a toast is up replaces it, which
// ends the first one's undo window — the first deletion simply stays final.
let toastSeq = 0
export async function deleteWithUndo(doc: JotDocument): Promise<void> {
  const ws = useWorkspace.getState()
  const placements = ws.closeDocumentEverywhere(doc.id)
  if (ws.renamingId === doc.id) ws.setRenaming(null)
  await deleteDocument(doc.id)
  ws.showToast({ kind: 'deleted', id: ++toastSeq, entry: { doc, placements } })
}

export async function undoDelete(toastId: number): Promise<void> {
  const ws = useWorkspace.getState()
  const t = ws.toast
  if (!t || t.kind !== 'deleted' || t.id !== toastId) return
  ws.showToast(null)
  await restoreDocument(t.entry.doc)
  ws.restorePlacements(t.entry.doc.id, t.entry.placements)
}

// File drop (6d's first-run copy): each dropped .md / .txt becomes a new
// document titled after the file.
const IMPORTABLE = /\.(md|markdown|txt)$/i
export async function importFiles(files: FileList | File[]): Promise<number> {
  const list = [...files].filter((f) => IMPORTABLE.test(f.name))
  let last: JotDocument | undefined
  for (const f of list) {
    last = await createDocument({ title: f.name.replace(IMPORTABLE, ''), content: await f.text() })
  }
  if (last) useWorkspace.getState().openDocument(last.id)
  return list.length
}
