import { invertedEffects, isolateHistory } from '@codemirror/commands'
import { RangeSet, RangeSetBuilder, StateEffect, Transaction, type Extension } from '@codemirror/state'
import { Decoration, EditorView, gutter, GutterMarker, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { notesInOrder } from '@/lib/annotations'
import type { Annotation } from '@/lib/db'
import { useAnnotations } from '@/state/annotations'
import { viewsOf } from './sessions'
import { useOverlays, type Anchor } from '@/state/overlays'

// Highlights, underlines and notes in the editor (round 4, frames 6–7).
// Highlights are washes behind full-strength ink, three colours, never the
// selection yellow; underline is plain and straight, so it never reads as a
// spelling mark; a note is a dotted underline with a small square on the
// gutter rule — click either to read it. Decorations follow edits at once;
// the stored list (state/annotations.ts) catches up in the same tick.

const refresh = StateEffect.define<null>()

// The editor the menu, keys and commands act on: the last one focused.
let active: { view: EditorView; documentId: string } | null = null
export function activeEditor() {
  return active && active.view.dom.isConnected ? active : null
}

// Undo and redo for marks (owner, 2026-11-15): adding or removing a
// highlight, underline or note is a step in the editor's own history, so
// Cmd+Z and Cmd+Shift+Z / Cmd+Y step through marks and typing in the order
// they happened. The step carries the document's list before and after;
// undoing it puts back the "before". Steps are undone in order, so the
// text is as it was when the list was taken. A note's wording isn't a step.
const marksChanged = StateEffect.define<{ before: Annotation[]; after: Annotation[] }>()
const undoableMarks = invertedEffects.of((tr) => tr.effects.filter((e) => e.is(marksChanged)).map((e) => marksChanged.of({ before: e.value.after, after: e.value.before })))
const marksFromHistory = (documentId: string) =>
  EditorView.updateListener.of((u) => {
    for (const tr of u.transactions) {
      if (!tr.isUserEvent('undo') && !tr.isUserEvent('redo')) continue
      for (const e of tr.effects) if (e.is(marksChanged)) useAnnotations.getState().set(documentId, e.value.after)
    }
  })

// Records a change to a document's marks (already made in the store) as an
// undo step, in the editor last focused on it.
export function recordMarks(documentId: string, before: Annotation[], after: Annotation[]) {
  const view = active?.documentId === documentId && active.view.dom.isConnected ? active.view : viewsOf(documentId)[0]
  view?.dispatch({ effects: marksChanged.of({ before, after }), annotations: [Transaction.addToHistory.of(true), isolateHistory.of('full'), Transaction.userEvent.of('annotate')] })
}

const markFor = (a: Annotation) =>
  a.kind === 'highlight'
    ? Decoration.mark({ class: `jot-hl jot-hl-${a.color ?? 1}`, attributes: { 'data-annotation': a.id } })
    : a.kind === 'underline'
      ? Decoration.mark({ class: 'jot-ul' })
      : Decoration.mark({ class: 'jot-note', attributes: { 'data-note': a.id } })

class NoteMarker extends GutterMarker {
  readonly id: string
  constructor(id: string) {
    super()
    this.id = id
  }
  eq(other: NoteMarker) {
    return other.id === this.id
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'jot-note-square'
    el.dataset.note = this.id
    el.title = 'note'
    return el
  }
}

function build(view: EditorView, documentId: string) {
  const list = useAnnotations.getState().byDoc[documentId] ?? []
  const len = view.state.doc.length
  const ranges = list
    .filter((a) => a.to > a.from && a.to <= len)
    .map((a) => markFor(a).range(a.from, a.to))
  const decorations: DecorationSet = Decoration.set(ranges, true)
  const gutterSet = new RangeSetBuilder<GutterMarker>()
  let lastLine = -1
  for (const n of notesInOrder(list)) {
    if (n.from > len) continue
    const line = view.state.doc.lineAt(n.from)
    if (line.number === lastLine) continue
    lastLine = line.number
    gutterSet.add(line.from, line.from, new NoteMarker(n.id))
  }
  return { decorations, gutter: gutterSet.finish() }
}

export function anchorOf(el: Element): Anchor {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, bottom: r.bottom }
}

function openNote(view: EditorView, documentId: string, id: string, el: Element) {
  // Hang the popover from the note's text when it's on screen.
  const text = view.contentDOM.querySelector(`[data-note="${id}"]`) ?? el
  useOverlays.getState().set({ note: { documentId, id, anchor: anchorOf(text), editing: false }, menu: null })
}

export function annotationsExtension(documentId: string): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      gutter: RangeSet<GutterMarker>
      unsubscribe: () => void
      view: EditorView
      constructor(view: EditorView) {
        this.view = view
        ;({ decorations: this.decorations, gutter: this.gutter } = build(view, documentId))
        let last = useAnnotations.getState().byDoc[documentId]
        const kick = () => queueMicrotask(() => view.dom.isConnected && view.dispatch({ effects: refresh.of(null) }))
        const offMarks = useAnnotations.subscribe((s) => {
          const now = s.byDoc[documentId]
          if (now === last) return
          last = now
          kick()
        })
        this.unsubscribe = offMarks
        void useAnnotations.getState().load(documentId, view.state.doc.toString())
      }
      update(u: ViewUpdate) {
        if (u.transactions.some((tr) => tr.effects.some((e) => e.is(refresh)))) {
          ;({ decorations: this.decorations, gutter: this.gutter } = build(u.view, documentId))
        } else if (u.docChanged) {
          this.decorations = this.decorations.map(u.changes)
          this.gutter = this.gutter.map(u.changes)
        }
        if (u.focusChanged && u.view.hasFocus) active = { view: u.view, documentId }
      }
      destroy() {
        this.unsubscribe()
        if (active?.view === this.view) active = null
      }
    },
    { decorations: (p) => p.decorations },
  )
  return [
    plugin,
    undoableMarks,
    marksFromHistory(documentId),
    gutter({
      class: 'cm-jot-notes',
      markers: (view) => view.plugin(plugin)?.gutter ?? RangeSet.empty,
      domEventHandlers: {
        mousedown(view, _line, event) {
          const el = (event.target as Element).closest?.('[data-note]')
          if (!el) return false
          openNote(view, documentId, (el as HTMLElement).dataset.note!, el)
          return true
        },
      },
    }),
    EditorView.domEventHandlers({
      click(event, view) {
        const el = (event.target as Element).closest?.('.jot-note[data-note]')
        // A plain click reads the note; a selection drag doesn't.
        if (!el || !view.state.selection.main.empty) return false
        openNote(view, documentId, (el as HTMLElement).dataset.note!, el)
        return false
      },
      // Right-click on the selection opens Jot's own menu (round 4, frame
      // 5); anywhere else the browser's menu is left alone.
      contextmenu(event, view) {
        const { from, to } = view.state.selection.main
        const at = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (from === to || at === null || at < from || at > to) return false
        event.preventDefault()
        active = { view, documentId }
        useOverlays.getState().set({ menu: { documentId, from, to, x: event.clientX, y: event.clientY }, note: null })
        return true
      },
      focus(_e, view) {
        active = { view, documentId }
        return false
      },
    }),
  ]
}
