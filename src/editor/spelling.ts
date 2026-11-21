import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Compartment, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { languageFor, scriptOf, type Script } from '@/lib/languages'
import { checkWords } from '@/lib/speller'
import type { Suggestion } from '@/lib/spelling'
import { usePacks } from '@/state/packs'
import { useOverlays } from '@/state/overlays'
import { useTypos, type Typo } from '@/state/spelling'
import { directionAt } from './direction'

// Spelling suggestions (Phase 16; suggestions, not auto-fix, since
// 2026-11-15 — the owner found fixes made behind them changed names): words
// the dictionary doesn't know are marked once typing pauses, with ranked
// fixes (lib/spelling.ts). Nothing changes until the person acts: a click on
// one applies the best guess, the status bar's "fix" applies every sure one
// as one undo step, and a right-click offers the next guesses, or ignore
// (the word stays unmarked from then on, everywhere). Never
// inside code, links or maths, never the word being typed; a capitalised
// word only where a sentence starts. Latin words are checked in the
// document's Latin language (English unless a pack is chosen) and never on
// a right-to-left line; Farsi or Arabic words only with their pack
// installed (lib/languages.ts). The speller runs in a worker
// (lib/speller.ts).

export const spellingCompartment = new Compartment()

const PAUSE = 600
const WORD = /[A-Za-z]+(?:'[A-Za-z]+)*/g
// Other Latin languages: accented letters too (é, ß, ñ, ij).
const LATIN_WORD = /\p{Script=Latin}+(?:['’]\p{Script=Latin}+)*/gu
// Farsi and Arabic: letters and their marks, joined by the ZWNJ; never digits.
const ARABIC_WORD = /(?:(?=\p{Script=Arabic})[\p{L}\p{M}])+(?:\u200c(?:(?=\p{Script=Arabic})[\p{L}\p{M}])+)*/gu
const SKIP = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'URL', 'Autolink', 'LinkLabel', 'HTMLTag', 'HTMLBlock', 'CodeText', 'CodeInfo'])

// Words the person chose to ignore and the default Latin language
// (settings), and the installed packs, kept current for the check.
let ignored = new Set<string>()
let latinDefault = 'en'
let installed: ReadonlySet<string> = usePacks.getState().installed
const ignoreListeners = new Set<() => void>()
const changed = () => {
  for (const l of ignoreListeners) l()
}
liveQuery(() => db.settings.get('settings')).subscribe({
  next: (s) => {
    const list = s?.spellIgnore ?? []
    const latin = s?.spellLatin ?? 'en'
    if (list.length === ignored.size && list.every((w) => ignored.has(w)) && latin === latinDefault) return
    ignored = new Set(list)
    latinDefault = latin
    changed()
  },
})
usePacks.subscribe((s) => {
  if (s.installed === installed) return
  installed = s.installed
  changed()
})

const setTypos = StateEffect.define<Typo[]>()
const typoMark = (t: Typo) => Decoration.mark({ class: 'jot-typo', attributes: { title: `${t.word} → ${t.fix} · click to fix${t.others.length ? ', right-click for more' : ''}` } })

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

function skipAt(state: EditorState, pos: number, script: Script) {
  // Parsed as far as this word, no further (incremental across calls).
  const tree = ensureSyntaxTree(state, pos + 1, 50) ?? syntaxTree(state)
  for (let n: { name: string; parent: unknown } | null = tree.resolveInner(pos, 1); n; n = n.parent as typeof n) if (SKIP.has(n.name)) return true
  const line = state.doc.lineAt(pos)
  if (/\$[^$]*$/.test(line.text.slice(0, pos - line.from))) return true
  return script === 'latin' && directionAt(state, pos) === 'rtl'
}

const codeLike = (text: string, from: number, to: number) => {
  const before = text[from - 1] ?? ''
  const after = text[to] ?? ''
  return /[\\/_@#\d]/.test(before) || /[/_@\d]/.test(after) || (after === '.' && /[A-Za-z]/.test(text[to + 1] ?? '')) || (before === '.' && /[A-Za-z]/.test(text[from - 2] ?? ''))
}

export const typosOf = (view: EditorView) => view.state.field(typoField, false) ?? []

export function applyTypo(view: EditorView, t: Typo, fix = t.fix) {
  if (view.state.sliceDoc(t.from, t.to) !== t.word) return
  view.dispatch({ changes: { from: t.from, to: t.to, insert: fix }, userEvent: 'input.spellfix' })
}

// Every typo with a sure fix fixed, as one edit — one Cmd+Z undoes them
// all. A close call is left marked, for a click or the right-click menu.
export function fixAllTypos(view: EditorView) {
  const list = typosOf(view).filter((t) => t.sure && view.state.sliceDoc(t.from, t.to) === t.word)
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

// Checking is kept off the typing path: an editor's first check (on
// opening a document, closing its rendered view, switching tabs) runs in
// slices that yield to the page; after that only the lines an edit touched
// are checked again. A word still being typed is held back and checked once
// the cursor leaves it.
const SLICE_MS = 8

function plugin(documentId: string) {
  return ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | undefined
      view: EditorView
      offIgnore: () => void
      // The document's own languages (status bar), if it chose any.
      docLang: { latin?: string; arabic?: string } = {}
      offDoc: () => void
      // Stretches to check again (null: none; "all": the whole document).
      dirty: { from: number; to: number } | 'all' | null = 'all'
      // The word the cursor was in at the last check.
      held: { from: number; to: number } | null = null
      run = 0
      constructor(view: EditorView) {
        this.view = view
        const recheck = () => {
          this.dirty = 'all'
          this.schedule(0)
        }
        ignoreListeners.add(recheck)
        this.offIgnore = () => ignoreListeners.delete(recheck)
        // Only a change of its languages counts, not every autosave.
        const sub = liveQuery(() => db.documents.get(documentId)).subscribe({
          next: (d) => {
            const next = { latin: d?.spellLatin, arabic: d?.spellArabic }
            if (next.latin === this.docLang.latin && next.arabic === this.docLang.arabic) return
            this.docLang = next
            recheck()
          },
        })
        this.offDoc = () => sub.unsubscribe()
        this.schedule(0)
      }
      schedule(delay: number) {
        clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.check(), delay)
      }
      update(u: ViewUpdate) {
        if (u.docChanged) {
          const changed: { from: number; to: number }[] = []
          u.changes.iterChangedRanges((_fa, _ta, from, to) => changed.push({ from, to }))
          if (this.dirty !== 'all') {
            let d = this.dirty && { from: u.changes.mapPos(this.dirty.from, -1), to: u.changes.mapPos(this.dirty.to, 1) }
            for (const c of changed) d = d ? { from: Math.min(d.from, c.from), to: Math.max(d.to, c.to) } : c
            this.dirty = d
          }
          if (this.held) this.held = { from: u.changes.mapPos(this.held.from, -1), to: u.changes.mapPos(this.held.to, 1) }
          useTypos.getState().set(documentId, typosOf(u.view))
          this.schedule(PAUSE)
        } else if (u.selectionSet && this.held) {
          const head = u.state.selection.main.head
          if (head < this.held.from || head > this.held.to) {
            const h = this.held
            this.dirty = this.dirty === 'all' ? 'all' : this.dirty ? { from: Math.min(this.dirty.from, h.from), to: Math.max(this.dirty.to, h.to) } : h
            this.held = null
            this.schedule(PAUSE)
          }
        }
      }
      async check() {
        const view = this.view
        const run = ++this.run
        if (!view.dom.isConnected || !this.dirty) return
        if (view.composing) return this.schedule(PAUSE)
        const state = view.state
        const doc = state.doc
        const dirty = this.dirty
        const first = dirty === 'all' ? 1 : doc.lineAt(Math.min(dirty.from, doc.length)).number
        const last = dirty === 'all' ? doc.lines : doc.lineAt(Math.min(dirty.to, doc.length)).number
        this.dirty = null
        const head = state.selection.main.head
        const latinLang = languageFor('latin', installed, latinDefault, this.docLang)
        const arabicLang = languageFor('arabic', installed, latinDefault, this.docLang)
        const scans: [RegExp, Script, string][] = [[latinLang === 'en' ? WORD : LATIN_WORD, 'latin', latinLang!]]
        if (arabicLang) scans.push([ARABIC_WORD, 'arabic', arabicLang])
        let held: { from: number; to: number } | null = null
        const words: { from: number; to: number; word: string; before: string; script: Script; lang: string }[] = []
        const requeue = () => {
          if (run === this.run) {
            this.dirty = dirty
            this.schedule(PAUSE)
          }
        }
        let sliceStart = performance.now()
        for (let n = first; n <= last; n++) {
          // Yield now and then; an edit meanwhile means starting over.
          if (performance.now() - sliceStart > SLICE_MS) {
            await new Promise((r) => setTimeout(r))
            if (run !== this.run || view.state.doc !== doc || !view.dom.isConnected) return requeue()
            sliceStart = performance.now()
          }
          const line = doc.line(n)
          for (const [pattern, script, lang] of scans) {
            for (const m of line.text.matchAll(pattern)) {
              const from = line.from + m.index
              const to = from + m[0].length
              // Still being typed: the cursor is in it or right after it.
              if (head >= from && head <= to) {
                held = { from, to }
                continue
              }
              // A LaTeX-style command (\newpage), not a word; nor one glued to a
              // slash, underscore, digit or a file name's dot (Cmd/Ctrl,
              // snake_case, file.ts) — code-like, left alone as code is.
              if (codeLike(line.text, m.index, m.index + m[0].length)) continue
              if (ignored.has(m[0].toLowerCase())) continue
              if (script === 'latin' && scriptOf(m[0]) !== 'latin') continue
              // Where it sits on its line matters only for a capitalised word.
              const before = m[0][0] !== m[0][0].toLowerCase() ? line.text.slice(0, m.index) : ''
              words.push({ from, to, word: m[0], before, script, lang })
            }
          }
        }
        // One request per language, each distinct word once.
        const answers = new Map<string, Suggestion | null>()
        const key = (w: { word: string; before: string; lang: string }) => `${w.lang}\u0000${w.word}\u0000${w.before}`
        for (const lang of new Set(words.map((w) => w.lang))) {
          const items = [...new Map(words.filter((w) => w.lang === lang).map((w) => [key(w), { word: w.word, before: w.before }])).values()]
          const results = await checkWords(lang, items)
          if (!results) continue
          items.forEach((it, i) => answers.set(key({ ...it, lang }), results[i]))
        }
        if (run !== this.run || !view.dom.isConnected) return
        if (view.state.doc !== doc) return requeue()
        const found: Typo[] = []
        for (const w of words) {
          const s = answers.get(key(w))
          if (s && !skipAt(state, w.from, w.script)) found.push({ from: w.from, to: w.to, word: w.word, fix: s.fixes[0], others: s.fixes.slice(1), sure: s.sure })
        }
        this.held = held
        const from = doc.line(first).from
        const to = doc.line(last).to
        const keep = dirty === 'all' ? [] : typosOf(view).filter((t) => t.to < from || t.from > to)
        const list = [...keep, ...found].sort((a, b) => a.from - b.from)
        view.dispatch({ effects: setTypos.of(list) })
        useTypos.getState().set(documentId, list)
      }
      destroy() {
        clearTimeout(this.timer)
        this.run++
        this.offIgnore()
        this.offDoc()
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
