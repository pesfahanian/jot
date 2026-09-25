import type { JotDocument, TagColor } from './db'

// Pure list logic for the sidebar: sort, color filter, search, timestamps.
// Kept free of React and storage so T6.2 can unit-test it directly.

export type SortMode = 'date' | 'name'

export const TAG_SLOTS: readonly TagColor[] = [1, 2, 3, 4, 5, 6]

const byName = (a: JotDocument, b: JotDocument) =>
  a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
const byDate = (a: JotDocument, b: JotDocument) => b.updatedAt - a.updatedAt

// Pinned documents stay on top regardless of sort; each block is sorted by
// the same mode.
export function arrangeDocuments(docs: JotDocument[], sort: SortMode): { pinned: JotDocument[]; rest: JotDocument[] } {
  const cmp = sort === 'name' ? byName : byDate
  return {
    pinned: docs.filter((d) => d.pinned).sort(cmp),
    rest: docs.filter((d) => !d.pinned).sort(cmp),
  }
}

// Color filter is a logical OR (ADR-007): a document has at most one color,
// so each selected color can only add matches. An empty selection means no
// filter. Pinned documents are filtered like any other (6d) — pinning sets
// position, not membership.
export function filterByColors(docs: JotDocument[], colors: ReadonlySet<TagColor>): JotDocument[] {
  if (colors.size === 0) return docs
  return docs.filter((d) => d.color !== null && colors.has(d.color))
}

export function colorCounts(docs: JotDocument[]): Record<TagColor, number> {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<TagColor, number>
  for (const d of docs) if (d.color !== null) counts[d.color]++
  return counts
}

export interface SearchHit {
  line: number
  text: string
  // Character ranges of the query inside `text`, for the --mark wash.
  ranges: [number, number][]
}

export interface SearchResult {
  doc: JotDocument
  titleMatch: boolean
  hits: SearchHit[]
}

const MAX_HITS_PER_DOC = 3

// Case-insensitive substring search over titles and full text (2b). A body
// hit carries its line number and the matched line; a title-only match is
// reported as such rather than faking a snippet.
export function searchDocuments(docs: JotDocument[], query: string): { results: SearchResult[]; matches: number } {
  const q = query.trim().toLowerCase()
  if (!q) return { results: [], matches: 0 }
  const results: SearchResult[] = []
  let matches = 0
  for (const doc of docs) {
    const titleMatch = doc.title.toLowerCase().includes(q)
    const hits: SearchHit[] = []
    let lineHits = 0
    const lines = doc.content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase()
      let at = lower.indexOf(q)
      if (at === -1) continue
      lineHits++
      if (hits.length < MAX_HITS_PER_DOC) {
        const ranges: [number, number][] = []
        while (at !== -1) {
          ranges.push([at, at + q.length])
          at = lower.indexOf(q, at + q.length)
        }
        hits.push({ line: i + 1, text: lines[i], ranges })
      }
    }
    if (titleMatch || lineHits) {
      results.push({ doc, titleMatch, hits })
      matches += lineHits || 1
    }
  }
  results.sort((a, b) => b.doc.updatedAt - a.doc.updatedAt)
  return { results, matches }
}

// Relative timestamps as the sidebar shows them: now, 2m, 3h, 21d, 1mo, 2y.
export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(d / 365)}y`
}

// "untitled", then "untitled-2", "untitled-3"… — titles aren't required to
// be unique, but a fresh document shouldn't collide with an existing one.
export function uniqueTitle(base: string, docs: JotDocument[]): string {
  const taken = new Set(docs.map((d) => d.title.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`.toLowerCase())) return `${base}-${n}`
}
