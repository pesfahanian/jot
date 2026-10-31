import { create } from 'zustand'
import { anchorAnnotations, mapAnnotations, type Mapper } from '@/lib/annotations'
import { db, type Annotation } from '@/lib/db'

// Each open document's highlights, underlines and notes (Phase 16). Loaded
// on first use and re-anchored to the text then; while the document is
// open they follow every edit (editor/sessions.ts) and are saved shortly
// after a change.

interface AnnotationsState {
  byDoc: Record<string, Annotation[]>
  load(documentId: string, text: string): Promise<Annotation[]>
  set(documentId: string, list: Annotation[]): void
  follow(documentId: string, changes: Mapper, text: string): void
}

const loading = new Map<string, Promise<Annotation[]>>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function save(documentId: string) {
  clearTimeout(timers.get(documentId))
  timers.set(
    documentId,
    setTimeout(() => {
      timers.delete(documentId)
      const list = useAnnotations.getState().byDoc[documentId] ?? []
      void db.transaction('rw', db.annotations, async () => {
        await db.annotations.where('documentId').equals(documentId).delete()
        await db.annotations.bulkPut(list)
      })
    }, 400),
  )
}

export const useAnnotations = create<AnnotationsState>()((set, get) => ({
  byDoc: {},
  load(documentId, text) {
    const have = get().byDoc[documentId]
    if (have) return Promise.resolve(have)
    let p = loading.get(documentId)
    if (!p) {
      p = db.annotations
        .where('documentId')
        .equals(documentId)
        .toArray()
        .then((stored) => {
          const list = anchorAnnotations(stored, text)
          set({ byDoc: { ...get().byDoc, [documentId]: list } })
          if (list.length !== stored.length || list.some((a, i) => a !== stored[i])) save(documentId)
          loading.delete(documentId)
          return list
        })
      loading.set(documentId, p)
    }
    return p
  },
  set(documentId, list) {
    set({ byDoc: { ...get().byDoc, [documentId]: list } })
    save(documentId)
  },
  follow(documentId, changes, text) {
    const list = get().byDoc[documentId]
    if (!list?.length) return
    const next = mapAnnotations(list, changes, text)
    if (next.length === list.length && next.every((a, i) => a === list[i])) return
    get().set(documentId, next)
  },
}))

// Annotations (and chats) of documents that no longer exist go at start-up — not at
// delete time, so undoing a delete brings them back with the document.
export async function dropOrphanAnnotations() {
  const ids = new Set(await db.documents.toCollection().primaryKeys())
  await db.annotations.filter((a) => !ids.has(a.documentId)).delete()
  // AI mode's chats go with their documents too (Phase 17).
  await db.chats.filter((c) => !ids.has(c.documentId)).delete()
}
