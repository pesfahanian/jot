import { useEffect, useMemo, useRef, useState } from 'react'
import type { JotDocument } from '@/lib/db'
import { cn } from '@/lib/utils'
import { importFiles, newDocument } from '@/state/actions'
import { useWorkspace } from '@/state/workspace'
import { KeyPanel } from '@/components/review/KeyPanel'
import { PaneEmpty } from './EditorPane'
import { PaneGrid } from './PaneGrid'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { Toast } from './Toast'

// The sidebar's resize handle is the seam itself: an 8px hit target with
// nothing drawn at rest (§1.9), range 180–460.
function SidebarHandle() {
  const setSidebarWidth = useWorkspace((s) => s.setSidebarWidth)
  const drag = useRef<{ x: number; w: number } | null>(null)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="resize sidebar"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, w: useWorkspace.getState().sidebarWidth }
      }}
      onPointerMove={(e) => drag.current && setSidebarWidth(drag.current.w + e.clientX - drag.current.x)}
      onPointerUp={() => (drag.current = null)}
      onDoubleClick={() => setSidebarWidth(248)}
      className="w-(--seam) flex-none cursor-col-resize"
    />
  )
}

// First run (6d): one headline, one action, no illustration.
function FirstRun() {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-document">
      <div className="h-[38px] flex-none border-b border-border bg-card" />
      <PaneEmpty>
        <div className="text-[22px] font-semibold tracking-[-0.025em]">no documents yet</div>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => void newDocument()}
            className="flex h-7 items-center rounded-md bg-primary px-[13px] font-mono text-[12px] font-semibold text-primary-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            new document
          </button>
          <span className="font-mono text-[11.5px] text-muted-foreground">or drop .md files anywhere</span>
        </div>
      </PaneEmpty>
    </section>
  )
}

export function Shell({ docs }: { docs: JotDocument[] }) {
  const panes = useWorkspace((s) => s.panes)
  const docsById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs])
  const [dropping, setDropping] = useState(false)

  // App-wide keys, captured before anything else sees them, wherever focus is:
  //   Cmd/Ctrl+S        does nothing — every edit already persists (ADR-008),
  //                     and the browser's "Save as" would only save the page
  //   Cmd/Ctrl+Shift+V  toggles the rendered view, as VSCode's preview
  //                     (replaces Chrome's "paste as plain text", which a
  //                     plain-text editor never needs)
  useEffect(() => {
    const save = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 's' && !e.shiftKey) e.preventDefault()
      if (key === 'v' && e.shiftKey) {
        e.preventDefault()
        useWorkspace.getState().toggleRender()
      }
    }
    window.addEventListener('keydown', save, { capture: true })
    return () => window.removeEventListener('keydown', save, { capture: true })
  }, [])

  // Drop .md files anywhere to import them (6d).
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDropping(true)
    }
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropping(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDropping(false)
      if (e.dataTransfer?.files.length) void importFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  return (
    // Floating-panel shell (§1.2b): the tray fills the viewport, panels sit
    // inside it, and the seam is the canvas showing between them.
    <div
      className={cn(
        'flex h-svh flex-col gap-(--seam) overflow-hidden rounded-(--radius-tray) border border-border-tray bg-background p-(--tray-pad) text-foreground',
        dropping && 'outline-2 -outline-offset-2 outline-primary',
      )}
    >
      <div className="flex min-h-0 flex-auto">
        {/* The key panel opens beside the sidebar's key row, over the panes. */}
        <div className="relative flex min-h-0">
          <Sidebar docs={docs} />
          <KeyPanel />
        </div>
        <SidebarHandle />
        <div className="relative flex min-w-0 flex-auto">
          {docs.length === 0 ? <FirstRun /> : <PaneGrid panes={panes} docsById={docsById} />}
          <Toast />
        </div>
      </div>
      <div className="relative flex-none">
        <StatusBar docsById={docsById} />
      </div>
    </div>
  )
}
