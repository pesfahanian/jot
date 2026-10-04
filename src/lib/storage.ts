// Jot's storage is the only copy of the person's writing (data safety,
// docs/todo.md). By default a browser may clear a site's storage when the
// disk runs low; asking for persistent storage stops that in Chrome, Edge
// and Firefox. It is not known to stop Safari's 7-day deletion — the
// storage warning covers that.
//
// Asked on an explicit action (a new document, an import), never while
// typing: Firefox answers with a permission prompt. At most once per app
// load, and not at all once granted; a later load asks again, which Chrome
// re-evaluates.

let asked = false

export async function requestPersistence(): Promise<void> {
  if (asked || !navigator.storage?.persist) return
  asked = true
  try {
    if (await navigator.storage.persisted()) return
    await navigator.storage.persist()
  } catch {
    /* unsupported or refused: storage stays best-effort */
  }
}
