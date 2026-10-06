import { syntaxTree } from '@codemirror/language'
import { Compartment, Facet, RangeSetBuilder, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, Direction, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { lineDirections, type Dir, type DirSetting } from '@/lib/direction'

// Farsi in the editor (Farsi design, frame 2): CodeMirror reads direction
// line by line from each line's CSS, so every right-to-left line gets
// dir="rtl" — decided per block by the shared function in lib/direction.ts,
// the same one the rendered view and the PDF use. Inside a right-to-left
// line, inline code, URLs and math are isolated left-to-right runs, so they
// read as typed and the cursor moves through them correctly. Farsi emphasis
// stays upright and goes bolder (600, 800 for strong); English keeps its
// italics — chosen by the script of the run.

// The document's own setting: auto (by block), or forced rtl / ltr.
export const dirSetting = Facet.define<DirSetting, DirSetting>({ combine: (v) => v[0] ?? 'auto' })
export const dirCompartment = new Compartment()
export const dirSettingFor = (setting: DirSetting): Extension => dirSetting.of(setting)

// The direction of every line, recomputed when the text or the setting
// changes.
const lineDirs = StateField.define<Dir[]>({
  create: (state) => compute(state),
  update: (dirs, tr) => (tr.docChanged || tr.startState.facet(dirSetting) !== tr.state.facet(dirSetting) ? compute(tr.state) : dirs),
})
function compute(state: EditorState): Dir[] {
  return lineDirections(state.doc.toString(), state.facet(dirSetting))
}

// The direction of the block a position sits in (the status bar's
// "dir auto · rtl").
export function directionAt(state: EditorState, pos: number): Dir {
  return state.field(lineDirs, false)?.[state.doc.lineAt(pos).number - 1] ?? 'ltr'
}

const rtlLine = Decoration.line({ attributes: { dir: 'rtl' } })
const isolate = Decoration.mark({ attributes: { dir: 'ltr' }, bidiIsolate: Direction.LTR })
const faEm = Decoration.mark({ class: 'cm-fa-em' })
const faStrong = Decoration.mark({ class: 'cm-fa-strong' })

const ISOLATED_NODES = new Set(['InlineCode', 'URL', 'Autolink'])
const INLINE_MATH = /\$\$[^$\n]+\$\$|\$[^$\s][^$\n]*?\$/g
const ARABIC_RUN = /[\p{Script=Arabic}](?:(?:[\p{Script=Arabic}\p{M} ]|\u200c|\u200d)*[\p{Script=Arabic}\p{M}])?/gu

interface Decos {
  lines: DecorationSet
  isolates: DecorationSet
  emphasis: DecorationSet
}

function build(view: EditorView): Decos {
  const dirs = view.state.field(lineDirs)
  const doc = view.state.doc
  const lines = new RangeSetBuilder<Decoration>()
  const isolates: { from: number; to: number }[] = []
  const emphasis: { from: number; to: number; deco: Decoration }[] = []
  const tree = syntaxTree(view.state)
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos)
      if (dirs[line.number - 1] === 'rtl') {
        lines.add(line.from, line.from, rtlLine)
        for (const m of line.text.matchAll(INLINE_MATH)) isolates.push({ from: line.from + m.index, to: line.from + m.index + m[0].length })
      }
      pos = line.to + 1
    }
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (ISOLATED_NODES.has(node.name)) {
          if (dirs[doc.lineAt(node.from).number - 1] === 'rtl') isolates.push({ from: node.from, to: node.to })
          return false
        }
        const strong = node.name === 'StrongEmphasis'
        if (strong || node.name === 'Emphasis') {
          const text = doc.sliceString(node.from, node.to)
          for (const m of text.matchAll(ARABIC_RUN)) emphasis.push({ from: node.from + m.index, to: node.from + m.index + m[0].length, deco: strong ? faStrong : faEm })
        }
      },
    })
  }
  const sorted = <T extends { from: number }>(a: T[]) => a.sort((x, y) => x.from - y.from)
  const iso = new RangeSetBuilder<Decoration>()
  let last = -1
  for (const r of sorted(isolates)) {
    if (r.from < last) continue // nested (a URL inside a link already isolated)
    iso.add(r.from, r.to, isolate)
    last = r.to
  }
  // Strong inside emphasis (***x***) is listed twice; the strong mark wins
  // because the CSS gives it the heavier weight either way.
  return {
    lines: lines.finish(),
    isolates: iso.finish(),
    emphasis: Decoration.set(sorted(emphasis).map((e) => e.deco.range(e.from, e.to)), true),
  }
}

const directionPlugin = ViewPlugin.fromClass(
  class {
    decos: Decos
    constructor(view: EditorView) {
      this.decos = build(view)
    }
    update(u: ViewUpdate) {
      const settingChanged = u.startState.facet(dirSetting) !== u.state.facet(dirSetting)
      if (u.docChanged || u.viewportChanged || settingChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decos = build(u.view)
    }
  },
  {
    provide: (plugin) => [
      EditorView.decorations.of((view) => view.plugin(plugin)?.decos.lines ?? Decoration.none),
      EditorView.decorations.of((view) => view.plugin(plugin)?.decos.isolates ?? Decoration.none),
      EditorView.decorations.of((view) => view.plugin(plugin)?.decos.emphasis ?? Decoration.none),
      EditorView.bidiIsolatedRanges.of((view) => view.plugin(plugin)?.decos.isolates ?? Decoration.none),
    ],
  },
)

const directionTheme = EditorView.baseTheme({
  // Upright: Farsi has no italics, and a synthetic slant reads as wrong.
  '.cm-fa-em, .cm-fa-em *': { fontStyle: 'normal !important', fontWeight: '600' },
  '.cm-fa-strong, .cm-fa-strong *': { fontStyle: 'normal !important', fontWeight: '800' },
})

export function directionExtension(setting: DirSetting): Extension {
  return [EditorView.perLineTextDirection.of(true), dirCompartment.of(dirSettingFor(setting)), lineDirs, directionPlugin, directionTheme]
}
