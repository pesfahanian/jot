import { isolateHistory } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import { Compartment, StateEffect, StateField, Transaction, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { fixFor, loadSpeller } from '@/lib/spelling'
import { directionAt } from './direction'

// Auto-fix spelling (Phase 16, off by default): clear typos are corrected
// behind you as you write — once the cursor has moved on and typing has
// paused a moment — so you never stop to go back. Each fix is its own undo
// step and flashes briefly so it's seen (round 4 motion spec: 400 ms hold,
// 600 ms fade; with motion off, a static wash for 1 s). Never inside code,
// links or maths, never a capitalised word, never on a right-to-left line
// (until tested there). A fix undone stays undone.

export const autofixCompartment = new Compartment()

const PAUSE = 700
const WORD = /[A-Za-z]+(?:'[A-Za-z]+)*/g
const SKIP = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'URL', 'Autolink', 'LinkLabel', 'HTMLTag', 'HTMLBlock', 'CodeText', 'CodeInfo'])

const flash = StateEffect.define<{ from: number; to: number } | null>()
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) if (e.is(flash)) deco = e.value ? Decoration.set([Decoration.mark({ class: 'jot-autofix' }).range(e.value.from, e.value.to)]) : Decoration.none
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

function skipAt(view: EditorView, pos: number) {
  for (let n: { name: string; parent: unknown } | null = syntaxTree(view.state).resolveInner(pos, 1); n; n = n.parent as typeof n) if (SKIP.has(n.name)) return true
  const line = view.state.doc.lineAt(pos).text
  if (/\$[^$]*$/.test(line.slice(0, pos - view.state.doc.lineAt(pos).from))) return true
  return directionAt(view.state, pos) === 'rtl'
}

const plugin = ViewPlugin.fromClass(
  class {
    // Stretches typed into since the last check; typos undone this session.
    pending: { from: number; to: number }[] = []
    declined = new Set<string>()
    last: { at: number; typo: string } | null = null
    timer: ReturnType<typeof setTimeout> | undefined
    view: EditorView
    constructor(view: EditorView) {
      this.view = view
      void loadSpeller()
    }
    update(u: ViewUpdate) {
      if (!u.docChanged) return
      this.pending = this.pending.map((r) => ({ from: u.changes.mapPos(r.from, -1), to: u.changes.mapPos(r.to, 1) }))
      for (const tr of u.transactions) {
        // Undoing a fix brings the typo back: leave that word alone now.
        if (tr.isUserEvent('undo') && this.last) {
          const at = tr.changes.mapPos(this.last.at)
          if (u.state.sliceDoc(at, at + this.last.typo.length) === this.last.typo) this.declined.add(this.last.typo)
        }
        if (!tr.isUserEvent('input.type') && !tr.isUserEvent('input.paste')) continue
        tr.changes.iterChangedRanges((_fa, _ta, from, to) => this.pending.push({ from, to }))
      }
      clearTimeout(this.timer)
      if (this.pending.length) this.timer = setTimeout(() => void this.check(), PAUSE)
    }
    async check() {
      const view = this.view
      if (!view.dom.isConnected || view.composing) return
      const spell = await loadSpeller().catch(() => null)
      if (!spell || !view.dom.isConnected) return
      const head = view.state.selection.main.head
      const keep: { from: number; to: number }[] = []
      const fixes: { from: number; to: number; insert: string; typo: string }[] = []
      for (const r of this.pending) {
        const line = view.state.doc.lineAt(Math.min(r.from, view.state.doc.length))
        const lineEnd = view.state.doc.lineAt(Math.min(r.to, view.state.doc.length)).to
        const text = view.state.sliceDoc(line.from, lineEnd)
        for (const m of text.matchAll(WORD)) {
          const from = line.from + m.index
          const to = from + m[0].length
          if (to < r.from || from > r.to) continue
          // Still being typed: the cursor is in or right after it.
          if (head >= from && head <= to) {
            keep.push({ from, to })
            continue
          }
          if (this.declined.has(m[0]) || skipAt(view, from)) continue
          const fix = fixFor(spell, m[0])
          if (fix) fixes.push({ from, to, insert: fix, typo: m[0] })
        }
      }
      this.pending = keep
      // One undo step per fix, the latest last so the flash lands on it.
      for (const f of fixes.sort((a, b) => b.from - a.from)) {
        view.dispatch({
          changes: { from: f.from, to: f.to, insert: f.insert },
          effects: flash.of({ from: f.from, to: f.from + f.insert.length }),
          annotations: [Transaction.userEvent.of('input.autofix'), Transaction.addToHistory.of(true), isolateHistory.of('full')],
        })
        this.last = { at: f.from, typo: f.typo }
      }
      if (fixes.length) setTimeout(() => view.dom.isConnected && view.dispatch({ effects: flash.of(null) }), 1000)
    }
    destroy() {
      clearTimeout(this.timer)
    }
  },
)

export const autofixFor = (on: boolean): Extension => (on ? [plugin, flashField] : [])
