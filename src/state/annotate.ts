import { covers, erase, paint } from '@/lib/annotations'
import { activeEditor, anchorOf } from '@/editor/annotations'
import { directionOf } from '@/lib/direction'
import { useAnnotations } from './annotations'
import { useOverlays, type Anchor } from './overlays'

// What the right-click menu and its keys do to the selection (Phase 16).
// A highlight or underline over text already wholly marked that way takes
// it off instead, so the same row (or key) toggles.

function selection() {
  const ed = activeEditor()
  if (!ed) return null
  const { from, to } = ed.view.state.selection.main
  if (from === to) return null
  return { ...ed, from, to, text: ed.view.state.doc.toString() }
}

const listOf = (documentId: string) => useAnnotations.getState().byDoc[documentId] ?? []

export const hasSelection = () => !!selection()

export function highlightSelection(color?: 1 | 2 | 3) {
  const s = selection()
  if (!s) return
  const c = color ?? useOverlays.getState().lastColor
  const list = listOf(s.documentId)
  const next = covers(list, 'highlight', s.from, s.to, c) ? erase(list, 'highlight', s.from, s.to, s.text) : paint(list, { documentId: s.documentId, kind: 'highlight', color: c }, s.from, s.to, s.text)
  useAnnotations.getState().set(s.documentId, next)
  useOverlays.getState().set({ lastColor: c, menu: null })
}

export function underlineSelection() {
  const s = selection()
  if (!s) return
  const list = listOf(s.documentId)
  const next = covers(list, 'underline', s.from, s.to) ? erase(list, 'underline', s.from, s.to, s.text) : paint(list, { documentId: s.documentId, kind: 'underline' }, s.from, s.to, s.text)
  useAnnotations.getState().set(s.documentId, next)
  useOverlays.getState().set({ menu: null })
}

// Where a stretch of the editor is on the page, for a popover under it.
function anchorFor(from: number, to: number): Anchor | null {
  const ed = activeEditor()
  if (!ed) return null
  const a = ed.view.coordsAtPos(from)
  const b = ed.view.coordsAtPos(to, -1)
  if (!a || !b) return null
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) }
}

export function addNote() {
  const s = selection()
  if (!s) return
  const now = Date.now()
  const id = crypto.randomUUID()
  useAnnotations.getState().set(s.documentId, [...listOf(s.documentId), { id, documentId: s.documentId, kind: 'note', from: s.from, to: s.to, quote: s.text.slice(s.from, s.to), body: '', createdAt: now, updatedAt: now }])
  const anchor = anchorFor(s.from, s.to)
  // Collapse the selection so the new note's underline shows at once.
  s.view.dispatch({ selection: { anchor: s.to } })
  if (anchor) useOverlays.getState().set({ menu: null, note: { documentId: s.documentId, id, anchor, editing: true } })
}

export function translateSelection() {
  const s = selection()
  if (!s) return
  const anchor = anchorFor(s.from, s.to)
  if (anchor) useOverlays.getState().set({ menu: null, translate: { documentId: s.documentId, from: s.from, to: s.to, text: s.text.slice(s.from, s.to), anchor } })
}

// Which way a selection translates: Farsi into English, anything else into
// Farsi (the two languages Jot knows).
export const translationTarget = (text: string) => (directionOf(text) === 'rtl' ? 'en' : 'fa')

export { anchorOf }
