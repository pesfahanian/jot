import type { Annotation } from './db'

// Annotations as data (Phase 16): pure moves on a document's list — follow
// an edit, find the text again, paint or erase a mark over a range — so the
// editor, the rendered view, exports and backups all agree. Highlights and
// underlines of one kind never overlap: painting over part of one cuts it.

type Kind = Annotation['kind']
export type Mapper = { mapPos(pos: number, assoc?: number): number }

const marks = (a: Annotation) => a.kind === 'highlight' || a.kind === 'underline'

// Follows an edit. A mark whose text was deleted goes; a note stays where
// its text was, with nothing under it, until it's deleted.
export function mapAnnotations(list: Annotation[], changes: Mapper, text: string): Annotation[] {
  const out: Annotation[] = []
  for (const a of list) {
    const from = changes.mapPos(a.from, 1)
    const to = Math.max(from, changes.mapPos(a.to, -1))
    if (from === to && marks(a)) continue
    out.push(from === a.from && to === a.to && text.slice(from, to) === a.quote ? a : { ...a, from, to, quote: text.slice(from, to) })
  }
  return out
}

// Finds every annotation in text that may have changed outside the editor:
// where its quote still stands, it stays; else the nearest place the quote
// appears; else marks go and notes keep their place.
export function anchorAnnotations(list: Annotation[], text: string): Annotation[] {
  const out: Annotation[] = []
  for (const a of list) {
    if (a.to <= text.length && text.slice(a.from, a.to) === a.quote) {
      out.push(a)
      continue
    }
    let best = -1
    if (a.quote) {
      for (let at = text.indexOf(a.quote); at !== -1; at = text.indexOf(a.quote, at + 1)) {
        if (best === -1 || Math.abs(at - a.from) < Math.abs(best - a.from)) best = at
      }
    }
    if (best !== -1) out.push({ ...a, from: best, to: best + a.quote.length })
    else if (!marks(a)) {
      const at = Math.min(a.from, text.length)
      out.push({ ...a, from: at, to: at, quote: '' })
    }
  }
  return out
}

// Removes a kind of mark from a range, cutting marks that run past it.
export function erase(list: Annotation[], kind: Kind, from: number, to: number, text: string, now = Date.now()): Annotation[] {
  const out: Annotation[] = []
  for (const a of list) {
    if (a.kind !== kind || a.to <= from || a.from >= to) {
      out.push(a)
      continue
    }
    if (a.from < from) out.push({ ...a, to: from, quote: text.slice(a.from, from), updatedAt: now })
    if (a.to > to) out.push({ ...a, id: a.from < from ? crypto.randomUUID() : a.id, from: to, quote: text.slice(to, a.to), updatedAt: now })
  }
  return out
}

// Puts a mark over a range (replacing that kind's marks there).
export function paint(list: Annotation[], init: Pick<Annotation, 'documentId' | 'kind' | 'color'>, from: number, to: number, text: string, now = Date.now()): Annotation[] {
  if (from >= to) return list
  const rest = erase(list, init.kind, from, to, text, now)
  return [...rest, { id: crypto.randomUUID(), ...init, from, to, quote: text.slice(from, to), createdAt: now, updatedAt: now }]
}

// Whether a range is wholly covered by one kind of mark (in one colour, for
// highlights) — then the menu's row takes it off instead.
export function covers(list: Annotation[], kind: Kind, from: number, to: number, color?: number): boolean {
  const spans = list.filter((a) => a.kind === kind && (color === undefined || a.color === color) && a.to > from && a.from < to).sort((a, b) => a.from - b.from)
  let at = from
  for (const a of spans) {
    if (a.from > at) return false
    at = Math.max(at, a.to)
  }
  return at >= to
}

export const notesInOrder = (list: Annotation[]) => list.filter((a) => a.kind === 'note').sort((a, b) => a.from - b.from || a.to - b.to)

// AI notes in queue order — the order they were written, which is the
// number each one wears.
export const aiNotesInOrder = (list: Annotation[]) => list.filter((a) => a.kind === 'ai-note').sort((a, b) => a.createdAt - b.createdAt)

// What leaves Jot in a print or an export: never AI notes.
export const printable = (list: Annotation[]) => list.filter((a) => a.kind !== 'ai-note')
