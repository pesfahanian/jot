import { RangeSet, RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state'
import { Decoration, EditorView, gutter, GutterMarker, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { aiNotesInOrder, notesInOrder } from '@/lib/annotations'
import { useWorkspace } from '@/state/workspace'
import type { Annotation } from '@/lib/db'
import { useAnnotations } from '@/state/annotations'
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

const markFor = (a: Annotation) =>
  a.kind === 'highlight'
    ? Decoration.mark({ class: `jot-hl jot-hl-${a.color ?? 1}`, attributes: { 'data-annotation': a.id } })
    : a.kind === 'underline'
      ? Decoration.mark({ class: 'jot-ul' })
      : Decoration.mark({ class: 'jot-note', attributes: { 'data-note': a.id } })

// An AI note's number (round 4, frame 11): an inverted pill before its
// text — the number the queue and the chat refer to it by.
class AiPill extends WidgetType {
  readonly n: number
  readonly id: string
  constructor(n: number, id: string) {
    super()
    this.n = n
    this.id = id
  }
  eq(other: AiPill) {
    return other.n === this.n && other.id === this.id
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'jot-ai-pill'
    el.dataset.ainote = this.id
    el.textContent = String(this.n)
    return el
  }
  ignoreEvent() {
    return false
  }
}

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

// AI notes show only while their document is in AI mode.
const inAiMode = (documentId: string) => useWorkspace.getState().aiMode?.documentId === documentId

function build(view: EditorView, documentId: string) {
  const all = useAnnotations.getState().byDoc[documentId] ?? []
  const list = all.filter((a) => a.kind !== 'ai-note')
  const len = view.state.doc.length
  const ranges = list
    .filter((a) => a.to > a.from && a.to <= len)
    .map((a) => markFor(a).range(a.from, a.to))
  if (inAiMode(documentId)) {
    aiNotesInOrder(all).forEach((a, i) => {
      if (a.from > len) return
      ranges.push(Decoration.widget({ widget: new AiPill(i + 1, a.id), side: -1 }).range(a.from))
      if (a.to > a.from) ranges.push(Decoration.mark({ class: 'jot-ainote', attributes: { 'data-ainote': a.id } }).range(a.from, Math.min(a.to, len)))
    })
  }
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
        let lastMode = inAiMode(documentId)
        const kick = () => queueMicrotask(() => view.dom.isConnected && view.dispatch({ effects: refresh.of(null) }))
        const offMarks = useAnnotations.subscribe((s) => {
          const now = s.byDoc[documentId]
          if (now === last) return
          last = now
          kick()
        })
        const offMode = useWorkspace.subscribe(() => {
          const now = inAiMode(documentId)
          if (now === lastMode) return
          lastMode = now
          kick()
        })
        this.unsubscribe = () => {
          offMarks()
          offMode()
        }
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
        const ai = (event.target as Element).closest?.('[data-ainote]') as HTMLElement | null
        if (ai && view.state.selection.main.empty) {
          useOverlays.getState().set({ note: { documentId, id: ai.dataset.ainote!, anchor: anchorOf(ai), editing: false }, menu: null })
          return false
        }
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
