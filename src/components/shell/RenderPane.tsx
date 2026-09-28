import type { EditorView } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import { followContent, openContent, viewsOf } from '@/editor/sessions'
import type { JotDocument, PaneLayout } from '@/lib/db'
import { renderBlocks, type RenderedBlock } from '@/lib/render'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/state/workspace'
import { TagMark } from './TagMark'

// The rendered pane (2g): one document, rendered, beside its editor. It
// follows the text as it's typed, and scrolls in step with every editor
// showing the same document, the way VSCode's preview does — by source line,
// not by percentage, so a tall table or code block on one side doesn't pull
// the two apart.

const RENDER_DELAY = 120

export function RenderPane({ pane, doc }: { pane: PaneLayout; doc: JotDocument }) {
  const focused = useWorkspace((s) => s.focusedPaneId === pane.id)
  const focusPane = useWorkspace((s) => s.focusPane)
  const closeTab = useWorkspace((s) => s.closeTab)
  const [blocks, setBlocks] = useState<RenderedBlock[] | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // Live text: every keystroke in any editor of this document, rendered
  // after a short pause; the stored text covers a document no editor holds.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let latest = 0
    const render = (text: string) => {
      const n = ++latest
      void renderBlocks(text).then((b) => n === latest && setBlocks(b))
    }
    render(openContent(doc.id) ?? doc.content)
    const stop = followContent(doc.id, (text) => {
      clearTimeout(timer)
      timer = setTimeout(() => render(text), RENDER_DELAY)
    })
    return () => {
      clearTimeout(timer)
      stop()
    }
    // doc.content: a change saved from elsewhere (e.g. an applied review).
  }, [doc.id, doc.content])

  useScrollSync(doc.id, scroller, blocks)

  return (
    <section
      onMouseDownCapture={() => focusPane(pane.id)}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-document"
    >
      <div className="flex h-[38px] flex-none items-stretch border-b border-border bg-card">
        <div
          className={cn(
            '-mb-px flex max-w-full min-w-0 items-center gap-2.5 border-r border-b-2 border-r-border bg-document px-3.5',
            focused ? 'border-b-primary' : 'border-b-ink-dim',
          )}
        >
          <TagMark color={doc.color} className="size-[7px]" />
          <span className="truncate text-[13px] font-medium text-foreground">{doc.title}</span>
          <span className="flex-none font-mono text-[11px] text-muted-foreground">rendered</span>
          <button
            type="button"
            aria-label={`close rendered ${doc.title}`}
            onClick={() => closeTab(pane.id, doc.id)}
            className="flex-none font-mono text-[13px] text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      </div>
      {/* Full pane width, as VSCode's preview (owner) — no measure cap. */}
      <div ref={scroller} className="relative min-h-0 flex-auto overflow-y-auto px-7 py-6">
        <div className="jot-rendered">
          {blocks?.map((b) => (
            <div key={`${b.line}:${b.html.length}`} data-line={b.line} dangerouslySetInnerHTML={{ __html: b.html }} />
          ))}
          {blocks?.length === 0 && <p className="text-muted-foreground">Nothing to render yet.</p>}
        </div>
      </div>
    </section>
  )
}

// ── Scroll sync ────────────────────────────────────────────────────────────
//
// Anchors are the rendered blocks, each tagged with the source line it
// starts on. Editor → rendered: the editor's top line (fractional) is placed
// between the two anchors around it, by line. Rendered → editor: the reverse.
// A scroll this code sets is remembered by its position, and the event it
// fires is recognised by landing there and ignored — so the two sides never
// chase each other, whatever the frame timing.

interface Anchor {
  line: number
  top: number
}

function anchorsOf(container: HTMLElement): Anchor[] {
  const base = container.getBoundingClientRect().top - container.scrollTop
  return [...container.querySelectorAll<HTMLElement>('[data-line]')].map((el) => ({
    line: Number(el.dataset.line),
    top: el.getBoundingClientRect().top - base,
  }))
}

// The editor's top visible line as a fractional, 0-based line number.
function topLine(view: EditorView): number {
  const y = view.scrollDOM.scrollTop - view.documentPadding.top
  const block = view.lineBlockAtHeight(Math.max(0, y))
  const line = view.state.doc.lineAt(block.from).number - 1
  return line + Math.min(1, Math.max(0, (y - block.top) / Math.max(1, block.height)))
}

// Positions set by sync, per element, so their echo events can be told apart.
const echoes = new WeakMap<HTMLElement, number>()
function setScroll(el: HTMLElement, y: number) {
  const before = el.scrollTop
  el.scrollTop = y
  // Read back: the browser clamps. No movement means no event to expect.
  if (Math.abs(el.scrollTop - before) >= 1) echoes.set(el, el.scrollTop)
}
function isEcho(el: HTMLElement) {
  const at = echoes.get(el)
  echoes.delete(el)
  return at !== undefined && Math.abs(el.scrollTop - at) < 2
}

function scrollEditorToLine(view: EditorView, line: number) {
  const doc = view.state.doc
  const n = Math.min(doc.lines, Math.max(1, Math.floor(line) + 1))
  const block = view.lineBlockAt(doc.line(n).from)
  setScroll(view.scrollDOM, view.documentPadding.top + block.top + (line - Math.floor(line)) * block.height)
}

const atBottom = (el: HTMLElement) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2
const toBottom = (el: HTMLElement) => setScroll(el, el.scrollHeight)

function useScrollSync(documentId: string, scroller: React.RefObject<HTMLDivElement | null>, blocks: RenderedBlock[] | null) {
  // Re-bind when panes change: editors of this document come and go.
  const panes = useWorkspace((s) => s.panes)
  const [views, setViews] = useState<EditorView[]>([])
  useEffect(() => {
    // After the panes' editors have mounted.
    const id = setTimeout(() => setViews(viewsOf(documentId)))
    return () => clearTimeout(id)
  }, [documentId, panes])

  useEffect(() => {
    const box = scroller.current
    if (!box || !blocks || views.length === 0) return
    const fromEditor = (view: EditorView) => () => {
      if (isEcho(view.scrollDOM)) return
      for (const other of views) if (other !== view && other.dom.isConnected) scrollEditorToLine(other, topLine(view))
      if (atBottom(view.scrollDOM)) return toBottom(box)
      if (view.scrollDOM.scrollTop <= 0) return setScroll(box, 0)
      const line = topLine(view)
      const anchors = anchorsOf(box)
      if (!anchors.length) return
      let i = anchors.findLastIndex((a) => a.line <= line)
      if (i === -1) i = 0
      const a = anchors[i]
      const b = anchors[i + 1] ?? { line: view.state.doc.lines, top: box.scrollHeight }
      const t = b.line > a.line ? (line - a.line) / (b.line - a.line) : 0
      setScroll(box, a.top + Math.max(0, Math.min(1, t)) * (b.top - a.top))
    }

    const fromRendered = () => {
      if (isEcho(box)) return
      const live = views.filter((v) => v.dom.isConnected)
      if (atBottom(box)) return live.forEach((v) => toBottom(v.scrollDOM))
      if (box.scrollTop <= 0) return live.forEach((v) => setScroll(v.scrollDOM, 0))
      const anchors = anchorsOf(box)
      if (!anchors.length) return
      const y = box.scrollTop
      let i = anchors.findLastIndex((a) => a.top <= y)
      if (i === -1) i = 0
      for (const v of live) {
        const a = anchors[i]
        const b = anchors[i + 1] ?? { line: v.state.doc.lines, top: box.scrollHeight }
        const t = b.top > a.top ? (y - a.top) / (b.top - a.top) : 0
        scrollEditorToLine(v, a.line + Math.max(0, Math.min(1, t)) * (b.line - a.line))
      }
    }

    const handlers = views.map((v) => [v, fromEditor(v)] as const)
    for (const [v, h] of handlers) v.scrollDOM.addEventListener('scroll', h)
    box.addEventListener('scroll', fromRendered)
    return () => {
      for (const [v, h] of handlers) v.scrollDOM.removeEventListener('scroll', h)
      box.removeEventListener('scroll', fromRendered)
    }
  }, [scroller, blocks, views])
}
