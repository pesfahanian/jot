import { liveQuery } from 'dexie'
import { db, type JotDocument } from './db'
import { updateDocument } from './documents'

// Continuous autosave (ADR-008). Every edit goes through write(); it lands in
// IndexedDB after a short pause in typing, and at least every MAX_WAIT_MS
// during continuous typing. Nothing here is exposed as a saved/unsaved
// state — the queued value is an internal write buffer, not a status.

const DEBOUNCE_MS = 250
const MAX_WAIT_MS = 2000

export interface Autosave {
  write(content: string): void
  flush(): Promise<void>
  dispose(): Promise<void>
}

export function createAutosave(documentId: string): Autosave {
  let queued: string | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined
  let chain: Promise<unknown> = Promise.resolve()

  // Current stored record, kept live so the unload path can write a whole
  // record in one synchronous put without a stale title or color.
  let stored: JotDocument | undefined
  const subscription = liveQuery(() => db.documents.get(documentId)).subscribe({
    next: (doc) => (stored = doc),
    error: (err) => console.error('autosave: watching document failed', err),
  })

  function clearTimers() {
    clearTimeout(debounceTimer)
    clearTimeout(maxWaitTimer)
    debounceTimer = maxWaitTimer = undefined
  }

  // Writes are chained so an older flush can never land after a newer one.
  function flush(): Promise<void> {
    clearTimers()
    if (queued === null) return chain.then(() => undefined)
    const content = queued
    queued = null
    chain = chain.then(() => updateDocument(documentId, { content })).catch((err) => {
      console.error('autosave failed', err)
    })
    return chain.then(() => undefined)
  }

  function write(content: string) {
    queued = content
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(flush, DEBOUNCE_MS)
    maxWaitTimer ??= setTimeout(flush, MAX_WAIT_MS)
  }

  // Leaving the tab, closing it or reloading writes whatever is queued. The
  // page can be torn down before any async step completes — even an IndexedDB
  // get — so this path issues a single put synchronously on the native handle.
  function flushNow() {
    if (queued === null) return
    if (!stored || !db.isOpen()) return void flush()
    clearTimers()
    const record: JotDocument = { ...stored, content: queued, updatedAt: Date.now() }
    queued = null
    stored = record
    const tx = db.backendDB().transaction('documents', 'readwrite')
    tx.objectStore('documents').put(record)
    tx.commit()
  }
  const onHide = () => {
    if (document.visibilityState === 'hidden') flushNow()
  }
  const onPageHide = () => flushNow()
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)

  return {
    write,
    flush,
    dispose() {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      return flush()
    },
  }
}
