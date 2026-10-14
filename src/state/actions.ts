import { db, type Comparison, type JotDocument, type TagColor } from '@/lib/db'
import { uniqueTitle } from '@/lib/docList'
import { createDocument, deleteDocument, listDocuments, restoreDocument, updateDocument } from '@/lib/documents'
import { diffTab } from './layout'
import { useWorkspace } from './workspace'
import { openContent } from '@/editor/sessions'
import { requestPersistence } from '@/lib/storage'

// Document-level actions shared by the sidebar, tabs and menus.

export const UNDO_WINDOW_MS = 8000

// New-document flow (T3.8): the + button creates "untitled" (or the next
// free "untitled-N") and opens it as a new tab in the focused pane. Its
// title then follows its first line, as Apple Notes (owner, 2026-10-14) —
// so no rename prompt: you just start writing. Search's "new document "q""
// passes the query as the title instead — the name is already chosen.
export async function newDocument(title?: string): Promise<JotDocument> {
  void requestPersistence()
  const docs = await listDocuments()
  const doc = await createDocument(title?.trim() ? { title: title.trim() } : { title: uniqueTitle('untitled', docs), autoTitle: true })
  const ws = useWorkspace.getState()
  ws.openDocument(doc.id)
  if (!title) {
    // Its row should be visible: an untagged new document would be hidden
    // by an active color filter or an open search.
    ws.clearColorFilter()
    ws.setSearch(false)
  }
  return doc
}

// A rename fixes the title: it stops following the first line. Confirming
// the name unchanged leaves an auto title as it is.
export async function renameDocument(id: string, title: string): Promise<void> {
  const next = title.trim()
  if (!next) return
  const doc = await db.documents.get(id)
  if (doc && next === doc.title) return
  await updateDocument(id, { title: next, autoTitle: false })
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
// document titled after the file; a dropped .zip — a workspace backup —
// brings in every document in it, with its tags, pins and dates. Either way
// they're added alongside what's there; nothing is replaced.
const IMPORTABLE = /\.(md|markdown|txt)$/i
export async function importFiles(files: FileList | File[]): Promise<number> {
  void requestPersistence()
  let last: JotDocument | undefined
  let count = 0
  for (const f of [...files]) {
    if (IMPORTABLE.test(f.name)) {
      last = await createDocument({ title: f.name.replace(IMPORTABLE, ''), content: await f.text() })
      count++
    } else if (/\.zip$/i.test(f.name)) {
      const { unpackWorkspace } = await import('@/lib/backup')
      for (const d of await unpackWorkspace(new Uint8Array(await f.arrayBuffer()))) {
        last = { ...d, id: crypto.randomUUID() }
        await restoreDocument(last)
        count++
      }
    }
  }
  if (last) useWorkspace.getState().openDocument(last.id)
  return count
}

// Import from a picker (bulk import): several files at once, or a whole
// folder — its .md / .markdown / .txt files and workspace .zips, at any
// depth; everything else is skipped. A folder picker is a plain file input
// (webkitdirectory, in every browser), not the File System Access API
// (ADR-003). Documents import alongside, as a drop does.
export function pickImport(kind: 'files' | 'folder'): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  if (kind === 'folder') input.webkitdirectory = true
  else input.accept = '.md,.markdown,.txt,.zip'
  input.addEventListener('change', async () => {
    const files = [...(input.files ?? [])]
    if (!files.length) return
    const count = await importFiles(files)
    const skipped = files.filter((f) => !IMPORTABLE.test(f.name) && !/\.zip$/i.test(f.name)).length
    useWorkspace.getState().showToast({
      kind: 'notice',
      id: Date.now(),
      lead: `imported ${count} document${count === 1 ? '' : 's'}${skipped ? ';' : ''}`,
      detail: skipped ? `${skipped} other file${skipped === 1 ? '' : 's'} skipped` : '',
    })
  })
  input.click()
}

// The whole workspace as one .zip download (lib/backup.ts). Open documents
// are taken as they stand in the editor, ahead of autosave.
export async function exportWorkspace(): Promise<void> {
  const { backupName, packWorkspace } = await import('@/lib/backup')
  const docs = (await listDocuments()).map((d) => ({ ...d, content: openContent(d.id) ?? d.content }))
  const bytes = await packWorkspace(docs)
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = backupName()
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// The diff checker: a new comparison opens as a diff tab in the focused
// pane (or the given one). "compare with…" starts with that document as
// the original, and the picker opens on the changed side.
export async function newComparison(opts: { docId?: string; paneId?: string } = {}): Promise<string> {
  const comparison: Comparison = {
    id: crypto.randomUUID(),
    left: opts.docId ? { kind: 'doc', docId: opts.docId } : { kind: 'empty' },
    right: { kind: 'empty' },
    stage: 'input',
    layout: 'split',
    hideUnchanged: false,
    ignoreWhitespace: false,
    precision: 'word',
    createdAt: Date.now(),
  }
  await db.comparisons.add(comparison)
  if (opts.docId) pickerRequests.add(comparison.id)
  useWorkspace.getState().openDocument(diffTab(comparison.id), { paneId: opts.paneId })
  return comparison.id
}

// Comparisons whose changed-side picker should open on arrival.
export const pickerRequests = new Set<string>()
