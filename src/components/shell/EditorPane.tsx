import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Editor } from '@/editor/Editor'
import { openContent } from '@/editor/sessions'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type JotDocument, type PaneLayout } from '@/lib/db'
import { exportMarkdown, exportPdf, exportPlainText } from '@/lib/export'
import { cn } from '@/lib/utils'
import { exportWorkspace, newDocument } from '@/state/actions'
import { useReview } from '@/state/review'
import { canSplit, columnsOf, docIdOf, isRenderTab, renderTab, type Edge } from '@/state/layout'
import { splitEdge, useWorkspace } from '@/state/workspace'
import { RenderView } from './RenderView'
import { DocumentMenu } from './DocumentMenu'
import { PlusIcon, SplitIcon } from './icons'
import { QuietButton } from './Sidebar'
import { TagMark } from './TagMark'

// The review view loads the first time a review opens.
const ReviewView = lazy(() => import('@/components/review/ReviewView').then((m) => ({ default: m.ReviewView })))

// Below this pane width, render and export fold into the ⋯ menu and split
// drops its label (6f). Two panes at 1400 keep the full set (2g); three fold.
const NARROW_PANE = 460

// Editor sizing per column count (6f, §1.9): one pane at the full 13.5 with a
// 46/10/22 gutter; two at 13 with 40/8/16; three at 13 with 34/8/12.
const density: Record<number, CSSProperties> = {
  1: {},
  2: { '--editor-size': '13px', '--gutter-width': '40px', '--gutter-pad': '8px', '--text-inset': '16px' } as CSSProperties,
  3: { '--editor-size': '13px', '--gutter-width': '34px', '--gutter-pad': '8px', '--text-inset': '12px' } as CSSProperties,
}

const control =
  'flex h-6 items-center gap-1.5 rounded-md border border-border-strong bg-control px-[9px] font-mono text-[11px] text-secondary-foreground hover:text-foreground data-[state=open]:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:text-ink-dim'

const liveText = (doc: JotDocument) => openContent(doc.id) ?? doc.content

function ExportItems({ doc }: { doc: JotDocument }) {
  return (
    <>
      <DropdownMenuItem onSelect={() => exportMarkdown(doc.title, liveText(doc))}>
        <span className="flex-auto">Markdown</span>
        <span className="font-mono text-[11px] text-muted-foreground">.md</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => exportPlainText(doc.title, liveText(doc))}>
        <span className="flex-auto">plain text</span>
        <span className="font-mono text-[11px] text-muted-foreground">.txt</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void exportPdf(doc.title, liveText(doc))}>
        <span className="flex-auto">PDF</span>
        <span className="font-mono text-[11px] text-muted-foreground">.pdf</span>
      </DropdownMenuItem>
      <WorkspaceExport />
    </>
  )
}

// Set apart from the document's own formats so it can't be mistaken for
// one: the whole workspace, every document, as a .zip backup (data safety).
function WorkspaceExport() {
  const count = useLiveQuery(() => db.documents.count(), []) ?? 0
  return (
    <>
      <DropdownMenuSeparator />
      <div className="px-2.5 pt-1 pb-0.5 font-mono text-[11px] text-muted-foreground">whole workspace</div>
      <DropdownMenuItem onSelect={() => void exportWorkspace()} title="every document, with tags and pins — a backup you can import by dropping it on jot">
        <span className="flex-auto">
          all {count} document{count === 1 ? '' : 's'}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">.zip</span>
      </DropdownMenuItem>
    </>
  )
}

function PaneControls({ doc, narrow }: { doc: JotDocument | undefined; narrow: boolean }) {
  const split = useWorkspace((s) => s.split)
  const toggleRender = useWorkspace((s) => s.toggleRender)
  const edge = useWorkspace((s) => splitEdge(s.panes, s.focusedPaneId))
  const rendered = useWorkspace((s) => !!doc && s.panes.some((p) => p.tabs.includes(renderTab(doc.id))))
  const canSplit = !!doc && !!edge
  // Render toggles this document's rendered tab (2g) — in a new pane where
  // split would open one, or in the neighbouring pane when the grid is full.
  const canRender = !!doc
  const renderTitle = rendered ? 'close the rendered view' : 'show this document rendered, beside it'
  const splitButton = (
    <button
      type="button"
      className={control}
      disabled={!canSplit}
      onClick={split}
      title={edge === 'bottom' ? 'open this document in a new pane below' : edge ? 'open this document in a new pane to the right' : 'no room for another pane here'}
    >
      <SplitIcon down={edge === 'bottom'} />
      {!narrow && 'split'}
    </button>
  )
  if (narrow) {
    return (
      <>
        {splitButton}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={control} disabled={!doc} title="more">
              ⋯
            </button>
          </DropdownMenuTrigger>
          {doc && (
            <DropdownMenuContent align="end" className="w-[232px]">
              <DropdownMenuItem disabled={!canRender} title={renderTitle} onSelect={toggleRender}>
                {rendered ? 'close render' : 'render'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2.5 pt-1 pb-0.5 font-mono text-[11px] text-muted-foreground">export</div>
              <ExportItems doc={doc} />
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </>
    )
  }
  return (
    <>
      {splitButton}
      <button
        type="button"
        className={cn(control, rendered && 'border-foreground text-foreground')}
        disabled={!canRender}
        aria-pressed={rendered}
        title={renderTitle}
        onClick={toggleRender}
      >
        render
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={control} disabled={!doc}>
            export <span className="text-muted-foreground">▾</span>
          </button>
        </DropdownMenuTrigger>
        {doc && (
          <DropdownMenuContent align="end" className="w-[232px]">
            <ExportItems doc={doc} />
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </>
  )
}

// A tab is a document's editor, or its rendered view (tabId "render:" + id,
// labelled "rendered") — both move, close and reorder the same way.
function Tab({ tabId, doc, active, focused, paneId }: { tabId: string; doc: JotDocument; active: boolean; focused: boolean; paneId: string }) {
  const rendered = isRenderTab(tabId)
  const inReview = useReview((s) => !rendered && s.openIn[paneId] === doc.id)
  const activateTab = useWorkspace((s) => s.activateTab)
  const closeTab = useWorkspace((s) => s.closeTab)
  const setDragTab = useWorkspace((s) => s.setDragTab)
  return (
    <DocumentMenu doc={doc}>
      <div
        // Drag to reorder, into another pane, or onto a pane's edge (Phase
        // 8). Not while its review is open: the review belongs to this pane.
        draggable={!inReview}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-jot-tab', tabId)
          e.dataTransfer.effectAllowed = 'move'
          setDragTab({ docId: tabId, from: paneId })
        }}
        onDragEnd={() => setDragTab(null)}
        role="tab"
        aria-selected={active}
        tabIndex={0}
        data-tab-id={tabId}
        onClick={() => activateTab(paneId, tabId)}
        onAuxClick={(e) => e.button === 1 && closeTab(paneId, tabId)}
        onKeyDown={(e) => e.key === 'Enter' && activateTab(paneId, tabId)}
        className={cn(
          'group flex max-w-[220px] flex-none cursor-default items-center gap-2.5 border-r border-border px-3.5 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          active
            ? cn('-mb-px border-b-2 bg-document text-foreground', focused ? 'border-b-primary' : 'border-b-ink-dim')
            : 'rounded-t-md text-secondary-foreground hover:bg-row-hover hover:text-foreground',
        )}
      >
        <TagMark color={doc.color} className="size-[7px]" />
        <span className={cn('truncate text-[13px]', active && 'font-medium')}>{doc.title}</span>
        {inReview && <span className="font-mono text-[11px] text-muted-foreground">review</span>}
        {rendered && <span className="font-mono text-[11px] text-muted-foreground">rendered</span>}
        <button
          type="button"
          aria-label={`close ${rendered ? 'rendered ' : ''}${doc.title}`}
          onClick={(e) => {
            e.stopPropagation()
            closeTab(paneId, tabId)
          }}
          className={cn('flex-none font-mono text-[13px] hover:text-foreground', active ? 'text-muted-foreground' : 'text-ink-dim')}
        >
          ×
        </button>
      </div>
    </DocumentMenu>
  )
}

// Tab overflow (T3.2): tabs keep their width and the strip scrolls
// sideways (wheel or trackpad), always bringing the active tab into view.
// When any tab is out of view, a count button at the strip's end lists every
// tab in the pane.
interface PaneTab {
  id: string
  doc: JotDocument
}

function TabStrip({ pane, tabs, focused }: { pane: PaneLayout; tabs: PaneTab[]; focused: boolean }) {
  const strip = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(0)
  const activateTab = useWorkspace((s) => s.activateTab)
  const dragging = useWorkspace((s) => !!s.dragTab)
  const dropTabOnStrip = useWorkspace((s) => s.dropTabOnStrip)
  // Where a dragged tab would land: the slot index and the bar's x.
  const [slot, setSlot] = useState<{ index: number; x: number } | null>(null)
  const slotAt = (clientX: number) => {
    const tabs = [...(strip.current?.querySelectorAll<HTMLElement>('[data-tab-id]') ?? [])]
    for (let i = 0; i < tabs.length; i++) {
      const r = tabs[i].getBoundingClientRect()
      if (clientX < r.left + r.width / 2) return { index: i, x: tabs[i].offsetLeft }
    }
    const last = tabs[tabs.length - 1]
    return { index: tabs.length, x: last ? last.offsetLeft + last.offsetWidth : 0 }
  }

  const measure = () => {
    const el = strip.current
    if (!el) return
    const box = el.getBoundingClientRect()
    let n = 0
    for (const t of el.querySelectorAll<HTMLElement>('[data-tab-id]')) {
      const r = t.getBoundingClientRect()
      if (r.left < box.left - 1 || r.right > box.right + 1) n++
    }
    setHidden(n)
  }

  useLayoutEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
  })
  useEffect(() => {
    const el = strip.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <div
        ref={strip}
        role="tablist"
        onScroll={measure}
        onDragOver={(e) => {
          if (!dragging) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setSlot(slotAt(e.clientX))
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setSlot(null)}
        onDrop={(e) => {
          if (!dragging) return
          e.preventDefault()
          dropTabOnStrip(pane.id, slotAt(e.clientX).index)
          setSlot(null)
        }}
        onWheel={(e) => {
          if (strip.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) strip.current.scrollLeft += e.deltaY
        }}
        className="relative flex min-w-0 flex-[0_1_auto] items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => (
          <Tab key={t.id} tabId={t.id} doc={t.doc} active={t.id === pane.active} focused={focused} paneId={pane.id} />
        ))}
        {dragging && slot && <span aria-hidden className="pointer-events-none absolute top-1.5 bottom-1.5 z-10 w-[2px] -translate-x-1/2 rounded-full bg-primary" style={{ left: Math.max(1, slot.x) }} />}
      </div>
      {/* New tab, as in a browser's tab bar (owner): right after the last
          tab, pinned at the edge once the tabs overflow. It does exactly
          what the sidebar's + does, in this pane (the click focuses it). */}
      <div className="flex flex-none items-center px-1">
        <button
          type="button"
          aria-label="new document"
          title="new document"
          onClick={() => void newDocument()}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <PlusIcon />
        </button>
      </div>
      {/* The rest of the bar: a drop target at the end of the strip. */}
      <div
        className="min-w-0 flex-auto"
        onDragOver={(e) => {
          if (!dragging) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(e) => {
          if (!dragging) return
          e.preventDefault()
          dropTabOnStrip(pane.id, tabs.length)
          setSlot(null)
        }}
      />
      {hidden > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={`${hidden} more ${hidden === 1 ? 'tab' : 'tabs'}`}
              className="flex flex-none items-center gap-1 border-l border-border px-2.5 font-mono text-[11px] text-secondary-foreground hover:text-foreground data-[state=open]:text-foreground"
            >
              +{hidden} <span className="text-muted-foreground">▾</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[232px]">
            {tabs.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => activateTab(pane.id, t.id)} className={cn(t.id === pane.active && 'text-foreground')}>
                <TagMark color={t.doc.color} className="size-[7px]" />
                <span className={cn('flex-auto truncate', t.id === pane.active && 'font-medium')}>{t.doc.title}</span>
                {isRenderTab(t.id) && <span className="font-mono text-[11px] text-muted-foreground">rendered</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}

// Drop zones over a pane's body while a tab is dragged (Phase 8; top and
// bottom in Phase 13): the outer quarter on each side opens a pane there —
// left/right a new column, top/bottom stacked in this column — with the
// half it would take shown; the middle moves the tab into this pane. Sides
// with no room in the grid are part of the middle.
const ZONE: Record<Edge | 'center', string> = {
  left: 'inset-y-2 left-2 w-[calc(50%-12px)]',
  right: 'inset-y-2 right-2 w-[calc(50%-12px)]',
  top: 'inset-x-2 top-2 h-[calc(50%-12px)]',
  bottom: 'inset-x-2 bottom-2 h-[calc(50%-12px)]',
  center: 'inset-2',
}

function DropZones({ paneId }: { paneId: string }) {
  const dragTab = useWorkspace((s) => s.dragTab)
  const panes = useWorkspace((s) => s.panes)
  const dropTabOnEdge = useWorkspace((s) => s.dropTabOnEdge)
  const [zone, setZone] = useState<Edge | 'center' | null>(null)
  if (!dragTab) return null
  const open = (edge: Edge) => canSplit(panes, dragTab, paneId, edge)
  const own = dragTab.from === paneId
  // The nearest edge within the outer quarter, if a pane can open there.
  const zoneAt = (e: React.DragEvent): Edge | 'center' => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const near = (
      [
        ['left', x],
        ['right', 1 - x],
        ['top', y],
        ['bottom', 1 - y],
      ] as [Edge, number][]
    )
      .filter(([edge, d]) => d < 0.25 && open(edge))
      .sort((a, b) => a[1] - b[1])
    return near[0]?.[0] ?? 'center'
  }
  return (
    <div
      className="absolute inset-x-0 top-[38px] bottom-0 z-20"
      onDragOver={(e) => {
        const z = zoneAt(e)
        // Its own pane's middle is no drop at all.
        if (z === 'center' && own) return setZone(null)
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setZone(z)
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setZone(null)}
      onDrop={(e) => {
        e.preventDefault()
        const z = zoneAt(e)
        setZone(null)
        dropTabOnEdge(paneId, z)
      }}
    >
      {zone && <div className={cn('pointer-events-none absolute rounded-md border-2 border-primary/70 bg-primary/10', ZONE[zone])} />}
    </div>
  )
}

function PaneEmpty({ children }: { children: ReactNode }) {
  return <div className="flex flex-auto flex-col justify-center gap-4 px-[72px] pb-10">{children}</div>
}

export function EditorPane({ pane, docsById, style }: { pane: PaneLayout; docsById: Map<string, JotDocument>; style?: CSSProperties }) {
  const columnCount = useWorkspace((s) => columnsOf(s.panes).length)
  const focused = useWorkspace((s) => s.focusedPaneId === pane.id)
  const focusPane = useWorkspace((s) => s.focusPane)
  const self = useRef<HTMLElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = self.current
    if (!el) return
    setNarrow(el.getBoundingClientRect().width < NARROW_PANE)
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < NARROW_PANE))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tabs = pane.tabs.flatMap((id) => {
    const doc = docsById.get(docIdOf(id))
    return doc ? [{ id, doc }] : []
  })
  // The active tab's document; the pane shows its editor, or its rendered
  // view when the active tab is a rendered one.
  const doc = pane.active ? docsById.get(docIdOf(pane.active)) : undefined
  const showRendered = isRenderTab(pane.active)
  const reviewHere = useReview((s) => !!doc && !showRendered && s.openIn[pane.id] === doc.id)
  const session = useReview((s) => (doc ? s.sessions[doc.id] : undefined))

  return (
    <section
      ref={self}
      onMouseDownCapture={() => focusPane(pane.id)}
      style={{ ...density[columnCount], ...style }}
      className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-document"
    >
      {!reviewHere && <DropZones paneId={pane.id} />}
      <div className="flex h-[38px] flex-none items-stretch border-b border-border bg-card">
        <TabStrip pane={pane} tabs={tabs} focused={focused} />
        {/* Controls sit on the focused pane only (6f). */}
        {focused && (
          <div className="flex flex-none items-center gap-1.5 border-l border-border pr-2 pl-3">
            <PaneControls doc={doc} narrow={narrow} />
          </div>
        )}
      </div>
      {doc && showRendered ? (
        <RenderView key={doc.id} doc={doc} />
      ) : doc ? (
        <>
          {session && reviewHere && (
            <Suspense fallback={<div className="flex-auto" />}>
              <ReviewView doc={doc} session={session} paneId={pane.id} />
            </Suspense>
          )}
          {/* The editor stays mounted under an open review: Apply writes
              through it as one transaction, so undo can reverse it. */}
          <div className={cn('flex min-h-0 flex-auto flex-col', session && reviewHere && 'hidden')}>
            <Editor key={doc.id} documentId={doc.id} initialContent={doc.content} paneId={pane.id} focused={focused && !(session && reviewHere)} />
          </div>
        </>
      ) : (
        // A pane with nothing open — only possible for the last pane, since
        // closing the last tab of any other pane closes that pane.
        <PaneEmpty>
          <div className="text-[13px] text-muted-foreground">no document open</div>
          <QuietButton onClick={() => void newDocument()}>new document</QuietButton>
        </PaneEmpty>
      )}
    </section>
  )
}

export { PaneEmpty }
