import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, layer, RectangleMarker, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { CODE_GROUPS } from '@/lib/code'

// Every color below is a CSS variable from index.css, so the editor follows
// a theme switch with no reconfiguration — light and dark differ only in the
// variable values (ADR-006).

// Design system §1.7.
const jotHighlight = HighlightStyle.define([
  { tag: t.heading, color: 'var(--syn-heading)', fontWeight: '600' },
  { tag: t.strong, color: 'var(--syn-emph)', fontWeight: '600' },
  { tag: t.emphasis, color: 'var(--syn-emph)', fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  // The underline is a decoration on the link text only (below): an underline
  // on the whole Link node would run through the URL and brackets too.
  { tag: t.link, color: 'var(--syn-link)' },
  { tag: t.url, color: 'var(--syn-punct)' },
  { tag: t.monospace, color: 'var(--syn-code)' },
  { tag: t.quote, color: 'var(--syn-quote)' },
  { tag: [t.processingInstruction, t.contentSeparator, t.labelName], color: 'var(--syn-punct)' },
  // Code in fenced blocks, coloured by its own language (lib/code.ts).
  ...CODE_GROUPS.map(({ name, tags }) => ({
    tag: tags,
    color: `var(--code-${name})`,
    ...(name === 'comment' ? { fontStyle: 'italic' } : {}),
  })),
])

// Treatments the highlighter can't express: heading markers take the heading
// hue at regular weight (8a/8b) rather than the generic markup-punctuation
// color, code-block lines get the inset ground, inline code its own ground,
// done tasks are struck.
const headingMark = Decoration.mark({ class: 'cm-jot-heading-mark' })
const codeBlockLine = Decoration.line({ class: 'cm-jot-codeblock' })
const linkText = Decoration.mark({ class: 'cm-jot-link-text' })
const inlineCode = Decoration.mark({ class: 'cm-jot-inline-code' })
const doneTask = Decoration.mark({ class: 'cm-jot-task-done' })

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { state } = view
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
          const first = state.doc.lineAt(node.from).number
          const last = state.doc.lineAt(node.to).number
          for (let n = first; n <= last; n++) {
            const line = state.doc.line(n)
            builder.add(line.from, line.from, codeBlockLine)
          }
          return false
        }
        if (node.name === 'HeaderMark') {
          builder.add(node.from, node.to, headingMark)
          return false
        }
        if (node.name === 'Link') {
          const marks = node.node.getChildren('LinkMark')
          // [text](url): the first two LinkMarks bracket the visible text.
          if (marks.length >= 2 && marks[1].from > marks[0].to) builder.add(marks[0].to, marks[1].from, linkText)
        }
        if (node.name === 'InlineCode') {
          builder.add(node.from, node.to, inlineCode)
          return false
        }
        if (node.name === 'Task') {
          const marker = node.node.getChild('TaskMarker')
          if (marker && /x/i.test(state.sliceDoc(marker.from, marker.to))) {
            const start = Math.min(marker.to + 1, node.to)
            if (start < node.to) builder.add(start, node.to, doneTask)
          }
        }
      },
    })
  }
  return builder.finish()
}

const markdownDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = buildDecorations(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

// Shell values from design system §1.8–§1.9: Source Code Pro 13.5, gutter
// 46px right-aligned with a 10px inner pad, text 22px past the rule (as 8a/8b
// render it), 18px top pad. The size variables are set per pane: split panes
// drop to 13px with a 40/8/16 gutter, three panes to 34/8/12 (6f).
const MONO = "'Source Code Pro', ui-monospace, monospace"

const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--foreground)',
    backgroundColor: 'var(--document)',
    fontSize: 'var(--editor-size, 13.5px)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: MONO,
    lineHeight: 'var(--leading-doc)',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '18px 0',
    caretColor: 'var(--primary)',
  },
  '.cm-line': { padding: '0 var(--text-inset, 22px)' },
  '.cm-gutters': {
    backgroundColor: 'var(--document)',
    color: 'var(--ink-dim)',
    border: 'none',
    borderRight: '1px solid var(--rule-on-document)',
  },
  '.cm-gutter.cm-lineNumbers': { minWidth: 'var(--gutter-width, 46px)' },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 var(--gutter-pad, 10px) 0 0',
    textAlign: 'right',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    fontWeight: '500',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--primary)', marginLeft: '-1px' },
  // Selection and search matches use the content-marking wash, never the
  // accent (§1.4b).
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--mark)',
  },
  '.cm-content ::selection': { backgroundColor: 'var(--mark)' },
  '.cm-searchMatch': { backgroundColor: 'var(--mark)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--mark)', outline: '1px solid var(--border-strong)' },
  '.cm-selectionMatch': { backgroundColor: 'transparent', textDecoration: 'underline', textDecorationColor: 'var(--border-strong)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'transparent',
    outline: '1px solid var(--border-strong)',
  },
  // The ground is drawn by codeBlockGround (below the selection), not here:
  // a line background would paint over the selection and hide it.
  '.cm-jot-codeblock': {
    borderLeft: '2px solid var(--border)',
    paddingLeft: 'calc(var(--text-inset, 22px) - 2px)',
  },
  '.cm-jot-codeblock-rect': { backgroundColor: 'var(--inset)' },
  '.cm-jot-heading-mark, .cm-jot-heading-mark *': { color: 'var(--syn-heading)', fontWeight: '400' },
  '.cm-jot-link-text': { textDecoration: 'underline', textUnderlineOffset: '3px' },
  '.cm-jot-inline-code': { backgroundColor: 'var(--code-inline)' },
  '.cm-jot-task-done': { color: 'var(--muted-foreground)', textDecoration: 'line-through' },

  // Search panel (Cmd+F). Undrawn in the design docs — kept to existing
  // tokens and control shapes (§1.9) until it gets a real design.
  '.cm-panels': { backgroundColor: 'var(--card)', color: 'var(--foreground)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--border)' },
  '.cm-search': { fontFamily: MONO, fontSize: '11px', padding: '6px 8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' },
  '.cm-search br': { display: 'none' },
  '.cm-search label': { display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--secondary-foreground)' },
  '.cm-textfield': {
    height: '22px',
    padding: '0 7px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--document)',
    color: 'var(--foreground)',
    fontFamily: MONO,
    fontSize: '11px',
  },
  '.cm-textfield:focus': { outline: 'none', borderColor: 'var(--primary)' },
  '.cm-button': {
    height: '22px',
    padding: '0 7px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)',
    backgroundImage: 'none',
    backgroundColor: 'var(--control)',
    color: 'var(--secondary-foreground)',
    fontFamily: MONO,
    fontSize: '11px',
  },
  '.cm-button:hover': { color: 'var(--foreground)' },
  '.cm-search [name=close]': { marginLeft: 'auto', color: 'var(--ink-dim)', fontSize: '13px', cursor: 'pointer' },
})

// Code-block ground (the inset), as a layer under the text. It must sit
// under the selection layer too — as a line background it covered the
// selection, so a drag-select inside code showed nothing. Must be listed
// after drawSelection(): under-text layers stack first-listed on top.
export const codeBlockGround = layer({
  above: false,
  class: 'cm-jot-codeblock-ground',
  update: (u) => u.docChanged || u.viewportChanged || u.geometryChanged,
  markers(view) {
    const markers: RectangleMarker[] = []
    const scroller = view.scrollDOM.getBoundingClientRect()
    const content = view.contentDOM.getBoundingClientRect()
    // Layer coordinates run from the scroller's scrolled origin.
    const baseLeft = scroller.left - view.scrollDOM.scrollLeft
    const baseTop = scroller.top - view.scrollDOM.scrollTop
    const tree = syntaxTree(view.state)
    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from,
        to,
        enter(node) {
          if (node.name !== 'FencedCode' && node.name !== 'CodeBlock') return
          const top = view.lineBlockAt(node.from).top + view.documentTop - baseTop
          const bottom = view.lineBlockAt(node.to).bottom + view.documentTop - baseTop
          markers.push(new RectangleMarker('cm-jot-codeblock-rect', content.left - baseLeft, top, content.width, bottom - top))
          return false
        },
      })
    }
    return markers
  },
})

export const jotEditorTheme = [baseTheme, syntaxHighlighting(jotHighlight), markdownDecorations]
