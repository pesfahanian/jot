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
import type { JotDocument, PaneLayout } from '@/lib/db'
import { exportMarkdown, exportPdf, exportPlainText } from '@/lib/export'
import { cn } from '@/lib/utils'
import { newDocument } from '@/state/actions'
import { useReview } from '@/state/review'
import { MAX_PANES, useWorkspace } from '@/state/workspace'
import { DocumentMenu } from './DocumentMenu'
import { SplitIcon } from './icons'
import { QuietButton } from './Sidebar'
import { TagMark } from './TagMark'

// The review view loads the first time a review opens.
const ReviewView = lazy(() => import('@/components/review/ReviewView').then((m) => ({ default: m.ReviewView })))

// Below this pane width, render and export fold into the ⋯ menu and split
// drops its label (6f). Two panes at 1400 keep the full set (2g); three fold.
const NARROW_PANE = 460

// Editor sizing per pane count (6f, §1.9): one pane at the full 13.5 with a
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
        <span className="flex-auto">Plain text</span>
        <span className="font-mono text-[11px] text-muted-foreground">.txt</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void exportPdf(doc.title, liveText(doc))}>
        <span className="flex-auto">PDF</span>
        <span className="font-mono text-[11px] text-muted-foreground">.pdf</span>
      </DropdownMenuItem>
      {/* The footer names the file once so each row doesn't repeat it (6a). */}
      <div title={`${doc.title}.*`} className="-mx-1 mt-1 -mb-1 truncate border-t border-border-subtle px-3.5 pt-[7px] pb-2 font-mono text-[11px] text-muted-foreground">
        saves as {doc.title}.*
      </div>
    </>
  )
}

function PaneControls({ doc, narrow }: { doc: JotDocument | undefined; narrow: boolean }) {
  const splitRight = useWorkspace((s) => s.splitRight)
  const paneCount = useWorkspace((s) => s.panes.length)
  const canSplit = !!doc && paneCount < MAX_PANES
  const split = (
    <button type="button" className={control} disabled={!canSplit} onClick={splitRight} title="open this document in a new pane to the right">
      <SplitIcon />
      {!narrow && 'split'}
    </button>
  )
  // "render" (2g) is drawn but not yet ticketed — present, inert.
  const renderTitle = 'rendered view — not built yet'
  if (narrow) {
    return (
      <>
        {split}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={control} disabled={!doc} title="more">
              ⋯
            </button>
          </DropdownMenuTrigger>
          {doc && (
            <DropdownMenuContent align="end" className="w-[232px]">
              <DropdownMenuItem disabled title={renderTitle}>
                render
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
      {split}
      <button type="button" className={control} disabled title={renderTitle}>
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

function Tab({ doc, active, focused, paneId }: { doc: JotDocument; active: boolean; focused: boolean; paneId: string }) {
  const inReview = useReview((s) => s.openIn[paneId] === doc.id)
  const activateTab = useWorkspace((s) => s.activateTab)
  const closeTab = useWorkspace((s) => s.closeTab)
  return (
    <DocumentMenu doc={doc}>
      <div
        role="tab"
        aria-selected={active}
        tabIndex={0}
        data-tab-id={doc.id}
        onClick={() => activateTab(paneId, doc.id)}
        onAuxClick={(e) => e.button === 1 && closeTab(paneId, doc.id)}
        onKeyDown={(e) => e.key === 'Enter' && activateTab(paneId, doc.id)}
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
        <button
          type="button"
          aria-label={`close ${doc.title}`}
          onClick={(e) => {
            e.stopPropagation()
            closeTab(paneId, doc.id)
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
function TabStrip({ pane, docs, focused }: { pane: PaneLayout; docs: JotDocument[]; focused: boolean }) {
  const strip = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(0)
  const activateTab = useWorkspace((s) => s.activateTab)

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
        onWheel={(e) => {
          if (strip.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) strip.current.scrollLeft += e.deltaY
        }}
        className="flex min-w-0 flex-auto items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {docs.map((d) => (
          <Tab key={d.id} doc={d} active={d.id === pane.active} focused={focused} paneId={pane.id} />
        ))}
      </div>
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
            {docs.map((d) => (
              <DropdownMenuItem key={d.id} onSelect={() => activateTab(pane.id, d.id)} className={cn(d.id === pane.active && 'text-foreground')}>
                <TagMark color={d.color} className="size-[7px]" />
                <span className={cn('flex-auto truncate', d.id === pane.active && 'font-medium')}>{d.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}

function PaneEmpty({ children }: { children: ReactNode }) {
  return <div className="flex flex-auto flex-col justify-center gap-4 px-[72px] pb-10">{children}</div>
}

export function EditorPane({ pane, docsById, paneCount }: { pane: PaneLayout; docsById: Map<string, JotDocument>; paneCount: number }) {
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

  const tabs = pane.tabs.map((id) => docsById.get(id)).filter((d): d is JotDocument => !!d)
  const doc = pane.active ? docsById.get(pane.active) : undefined
  const reviewHere = useReview((s) => !!doc && s.openIn[pane.id] === doc.id)
  const session = useReview((s) => (doc ? s.sessions[doc.id] : undefined))

  return (
    <section
      ref={self}
      onMouseDownCapture={() => focusPane(pane.id)}
      style={density[paneCount]}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-document"
    >
      <div className="flex h-[38px] flex-none items-stretch border-b border-border bg-card">
        <TabStrip pane={pane} docs={tabs} focused={focused} />
        {/* Controls sit on the focused pane only (6f). */}
        {focused && (
          <div className="flex flex-none items-center gap-1.5 border-l border-border pr-2 pl-3">
            <PaneControls doc={doc} narrow={narrow} />
          </div>
        )}
      </div>
      {doc ? (
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
          <div className="text-[13px] text-muted-foreground">No document open</div>
          <QuietButton onClick={() => void newDocument()}>new document</QuietButton>
        </PaneEmpty>
      )}
    </section>
  )
}

export { PaneEmpty }
