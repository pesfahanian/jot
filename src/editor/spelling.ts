import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Compartment, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { loadSpeller, suggestionFor } from '@/lib/spelling'
import { useOverlays } from '@/state/overlays'
import { useTypos, type Typo } from '@/state/spelling'
import { directionAt } from './direction'

// Spelling suggestions (Phase 16; suggestions, not auto-fix, since
// 2026-11-15 — the owner found fixes made behind them changed names): clear
// English typos get a wavy underline once typing pauses. Nothing changes
// until the person acts: a click on one applies its fix, the status bar's
// "fix all" applies every one as one undo step, and a right-click offers
// fix or ignore (the word stays unmarked from then on, everywhere). Never
// inside code, links or maths, never on a right-to-left line, never the
// word being typed; a capitalised word only where a sentence starts.

export const spellingCompartment = new Compartment()

const PAUSE = 600
const WORD = /[A-Za-z]+(?:'[A-Za-z]+)*/g
const SKIP = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'URL', 'Autolink', 'LinkLabel', 'HTMLTag', 'HTMLBlock', 'CodeText', 'CodeInfo'])

// Words the person chose to ignore (settings), kept current for the check.
let ignored = new Set<string>()
const ignoreListeners = new Set<() => void>()
liveQuery(() => db.settings.get('settings')).subscribe({
  next: (s) => {
    ignored = new Set(s?.spellIgnore ?? [])
    for (const l of ignoreListeners) l()
  },
})

const setTypos = StateEffect.define<Typo[]>()
const typoMark = (t: Typo) => Decoration.mark({ class: 'jot-typo', attributes: { title: `${t.word} → ${t.fix} · click to fix` } })

// The marked typos, mapped through edits; one an edit touches goes at once.
const typoField = StateField.define<Typo[]>({
  create: () => [],
  update(list, tr) {
    for (const e of tr.effects) if (e.is(setTypos)) return e.value
    if (!tr.docChanged) return list
    return list.filter((t) => !tr.changes.touchesRange(t.from, t.to)).map((t) => ({ ...t, from: tr.changes.mapPos(t.from, 1), to: tr.changes.mapPos(t.to, -1) }))
  },
  provide: (f) => EditorView.decorations.from(f, (list): DecorationSet => Decoration.set(list.map((t) => typoMark(t).range(t.from, t.to)))),
})

function skipAt(state: EditorState, pos: number) {
  for (let n: { name: string; parent: unknown } | null = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent as typeof n) if (SKIP.has(n.name)) return true
  const line = state.doc.lineAt(pos)
  if (/\$[^$]*$/.test(line.text.slice(0, pos - line.from))) return true
  return directionAt(state, pos) === 'rtl'
}

export const typosOf = (view: EditorView) => view.state.field(typoField, false) ?? []

export function applyTypo(view: EditorView, t: Typo) {
  if (view.state.sliceDoc(t.from, t.to) !== t.word) return
  view.dispatch({ changes: { from: t.from, to: t.to, insert: t.fix }, userEvent: 'input.spellfix' })
}

// Every marked typo fixed, as one edit — one Cmd+Z undoes them all.
export function fixAllTypos(view: EditorView) {
  const list = typosOf(view).filter((t) => view.state.sliceDoc(t.from, t.to) === t.word)
  if (list.length) view.dispatch({ changes: list.map((t) => ({ from: t.from, to: t.to, insert: t.fix })), userEvent: 'input.spellfix' })
}

// The editor whose typo's menu is open (components/annotations/TypoMenu).
let menuView: EditorView | null = null
export const typoMenuView = () => menuView

const typoAt = (view: EditorView, target: EventTarget | null) => {
  const el = (target as Element | null)?.closest?.('.jot-typo')
  if (!el) return null
  const pos = view.posAtDOM(el)
  return typosOf(view).find((t) => t.from <= pos && pos < t.to) ?? null
}

function plugin(documentId: string) {
  return ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | undefined
      view: EditorView
      offIgnore: () => void
      constructor(view: EditorView) {
        this.view = view
        const recheck = () => void this.check()
        ignoreListeners.add(recheck)
        this.offIgnore = () => ignoreListeners.delete(recheck)
        void this.check()
      }
      update(u: ViewUpdate) {
        if (u.docChanged) {
          useTypos.getState().set(documentId, typosOf(u.view).length)
          clearTimeout(this.timer)
          this.timer = setTimeout(() => void this.check(), PAUSE)
        }
      }
      async check() {
        const view = this.view
        const spell = await loadSpeller().catch(() => null)
        if (!spell || !view.dom.isConnected) return
        if (view.composing) return void (this.timer = setTimeout(() => void this.check(), PAUSE))
        const { state } = view
        ensureSyntaxTree(state, state.doc.length, 100)
        const head = state.selection.main.head
        const found: Typo[] = []
        for (let n = 1; n <= state.doc.lines; n++) {
          const line = state.doc.line(n)
          for (const m of line.text.matchAll(WORD)) {
            const from = line.from + m.index
            const to = from + m[0].length
            // Still being typed: the cursor is in it or right after it.
            if (head >= from && head <= to) continue
            if (ignored.has(m[0].toLowerCase())) continue
            const fix = suggestionFor(spell, m[0], line.text.slice(0, m.index))
            if (fix && !skipAt(state, from)) found.push({ from, to, word: m[0], fix })
          }
        }
        // Text typed during the check moved things: the next check redoes it.
        if (view.state.doc !== state.doc) return
        view.dispatch({ effects: setTypos.of(found) })
        useTypos.getState().set(documentId, found.length)
      }
      destroy() {
        clearTimeout(this.timer)
        this.offIgnore()
      }
    },
  )
}

const handlers = (documentId: string) =>
  EditorView.domEventHandlers({
    // A plain click on a typo applies its fix.
    mousedown(event, view) {
      if (event.button !== 0 || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false
      const t = typoAt(view, event.target)
      if (!t) return false
      event.preventDefault()
      applyTypo(view, t)
      return true
    },
    // Right-click: fix, fix all, or ignore — unless text is selected there,
    // which is the selection menu's.
    contextmenu(event, view) {
      const t = typoAt(view, event.target)
      const sel = view.state.selection.main
      if (!t || (!sel.empty && sel.from <= t.from && sel.to >= t.to)) return false
      event.preventDefault()
      menuView = view
      useOverlays.getState().set({ typo: { documentId, typo: t, x: event.clientX, y: event.clientY }, menu: null, note: null })
      return true
    },
  })

export const spellingFor = (on: boolean, documentId: string): Extension => (on ? [typoField, plugin(documentId), handlers(documentId)] : [])
