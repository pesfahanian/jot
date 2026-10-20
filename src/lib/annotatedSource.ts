import { markdownLanguage } from '@codemirror/lang-markdown'
import type { Annotation } from './db'

// Annotations carried through the markdown renderer (rendered view, PDF)
// and into markdown export (Phase 16). The source gets invisible markers
// (private-use characters) around each annotated stretch; after rendering
// they become spans. Overlapping annotations are cut into non-overlapping
// pieces, each with every class that covers it, so tags always nest. A
// stretch is cut at line ends and table cells, never starts inside a line's
// markdown (heading marks, list bullets), takes inline code, maths and URLs
// whole, and leaves code blocks, maths blocks and diagrams alone.

export const OPEN = ''
export const SEP = ''
export const CLOSE = ''
export const CALL = ''

export type Piece = { from: number; to: number; ids: string[] }

// Where markers can't go: [from, to, whole] — whole means a stretch that
// touches it takes all of it (inline code, URLs, inline maths); otherwise
// nothing inside it is marked (code and maths blocks, diagrams, HTML).
function protectedRanges(text: string): [number, number, boolean][] {
  const out: [number, number, boolean][] = []
  markdownLanguage.parser.parse(text).iterate({
    enter: (n) => {
      if (n.name === 'FencedCode' || n.name === 'CodeBlock' || n.name === 'HTMLBlock' || n.name === 'CommentBlock') {
        out.push([n.from, n.to, false])
        return false
      }
      if (n.name === 'InlineCode' || n.name === 'URL' || n.name === 'Autolink' || n.name === 'HTMLTag' || n.name === 'Image' || n.name === 'LinkTitle') {
        out.push([n.from, n.to, true])
        return false
      }
    },
  })
  for (const m of text.matchAll(/^\$\$[\s\S]*?^\$\$/gm)) out.push([m.index, m.index + m[0].length, false])
  for (const m of text.matchAll(/\$\$[^\n$]+\$\$|\$[^$\s][^$\n]*?\$/g)) out.push([m.index, m.index + m[0].length, true])
  return out
}

const LINE_START = /^(?:[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d{1,9}[.)][ \t]+))+/

// The stretches an annotation can be drawn on: cut at line ends (and table
// cell bars), past line-start markdown, around protected regions.
export function drawable(text: string, from: number, to: number, guard = protectedRanges(text)): [number, number][] {
  const out: [number, number][] = []
  let at = from
  while (at < to) {
    const lineEnd = text.indexOf('\n', at)
    const end = Math.min(to, lineEnd === -1 ? text.length : lineEnd)
    const lineStart = text.lastIndexOf('\n', at - 1) + 1
    const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
    const lead = lineStart + (line.match(LINE_START)?.[0].length ?? 0)
    let a = Math.max(at, lead)
    // Table rows: each cell on its own.
    const isRow = /^\s*\|.*\|\s*$/.test(line)
    const cuts = isRow ? [...line.matchAll(/\|/g)].map((m) => lineStart + m.index) : []
    const cells: [number, number][] = []
    for (const c of [...cuts, end].filter((c) => c > a).sort((x, y) => x - y)) {
      const b = Math.min(c, end)
      if (b > a) cells.push([a, b])
      a = c + 1
      if (a >= end) break
    }
    for (let [p, q] of cells) {
      for (const [gf, gt, whole] of guard) {
        if (gt <= p || gf >= q) continue
        if (whole) {
          p = Math.min(p, gf)
          q = Math.max(q, gt)
        }
      }
      // Cut away block regions.
      let segs: [number, number][] = [[p, q]]
      for (const [gf, gt, whole] of guard) {
        if (whole) continue
        segs = segs.flatMap(([s, e]) => (gt <= s || gf >= e ? [[s, e] as [number, number]] : ([[s, gf], [gt, e]] as [number, number][]).filter(([x, y]) => y > x)))
      }
      for (const [s, e] of segs) {
        // Never only whitespace.
        if (text.slice(s, e).trim()) out.push([s, e])
      }
    }
    at = lineEnd === -1 ? to : lineEnd + 1
  }
  return out
}

// Every drawable stretch of every annotation, cut where any of them starts
// or ends, so each piece has one fixed set of annotations over it.
export function pieces(text: string, list: Annotation[]): Piece[] {
  const guard = protectedRanges(text)
  const spans = list.filter((a) => a.to > a.from).flatMap((a) => drawable(text, a.from, a.to, guard).map(([from, to]) => ({ from, to, id: a.id })))
  const cuts = [...new Set(spans.flatMap((s) => [s.from, s.to]))].sort((a, b) => a - b)
  const out: Piece[] = []
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [from, to] = [cuts[i], cuts[i + 1]]
    const ids = spans.filter((s) => s.from <= from && s.to >= to).map((s) => s.id)
    if (ids.length) out.push({ from, to, ids })
  }
  return out
}

// The source with markers: OPEN + piece index + SEP … CLOSE around each
// piece, and CALL + note index + SEP where a note's footnote goes (after the
// last drawable stretch of its text).
export function markSource(text: string, list: Annotation[], notes: Annotation[] = []): { text: string; pieces: Piece[] } {
  const ps = pieces(text, list)
  const inserts: { at: number; s: string; order: number }[] = []
  ps.forEach((p, i) => {
    inserts.push({ at: p.from, s: `${OPEN}${i}${SEP}`, order: 1 })
    inserts.push({ at: p.to, s: CLOSE, order: 0 })
  })
  const guard = protectedRanges(text)
  notes.forEach((n, i) => {
    const d = drawable(text, n.from, n.to, guard)
    const at = d.length ? d[d.length - 1][1] : n.to
    inserts.push({ at, s: `${CALL}${i}${SEP}`, order: 0.5 })
  })
  inserts.sort((a, b) => a.at - b.at || a.order - b.order)
  let out = ''
  let at = 0
  for (const ins of inserts) {
    out += text.slice(at, ins.at) + ins.s
    at = ins.at
  }
  return { text: out + text.slice(at), pieces: ps }
}

const MARKER = new RegExp(`${OPEN}(\\d+)${SEP}|${CLOSE}|${CALL}(\\d+)${SEP}`, 'g')

// Rendered HTML with the markers turned into spans and footnotes; markers
// that ended up somewhere they can't render (an attribute, a stripped
// block) are dropped.
export function unmarkHtml(html: string, open: (piece: number) => string, call: (note: number) => string): string {
  return html.replace(MARKER, (_m, piece, note) => (piece !== undefined ? open(Number(piece)) : note !== undefined ? call(Number(note)) : '</span>'))
}

export const stripMarkers = (s: string) => s.replace(MARKER, '')

// Markdown export with annotations (round 4, frame 9c): highlights become
// ==text== whatever their colour, underline has no markdown and is dropped,
// notes become [^n] footnotes at the end of their text.
export function annotatedMarkdown(text: string, list: Annotation[]): string {
  const highlights = list.filter((a) => a.kind === 'highlight')
  const notes = list.filter((a) => a.kind === 'note' && a.body?.trim()).sort((a, b) => a.to - b.to)
  const guard = protectedRanges(text)
  const inserts: { at: number; s: string; order: number }[] = []
  // Highlights merged where they touch, so ==a====b== never appears.
  const stretches = highlights.flatMap((a) => drawable(text, a.from, a.to, guard)).sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [s, e] of stretches) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  for (const [s, e] of merged) {
    inserts.push({ at: s, s: '==', order: 1 }, { at: e, s: '==', order: 0 })
  }
  notes.forEach((n, i) => {
    const d = drawable(text, n.from, n.to, guard)
    inserts.push({ at: d.length ? d[d.length - 1][1] : n.to, s: `[^${i + 1}]`, order: 0.5 })
  })
  inserts.sort((a, b) => a.at - b.at || a.order - b.order)
  let out = ''
  let at = 0
  for (const ins of inserts) {
    out += text.slice(at, ins.at) + ins.s
    at = ins.at
  }
  out += text.slice(at)
  if (notes.length) out = out.replace(/\s*$/, '\n\n') + notes.map((n, i) => `[^${i + 1}]: ${n.body!.trim().replace(/\n+/g, ' ')}`).join('\n') + '\n'
  return out
}
