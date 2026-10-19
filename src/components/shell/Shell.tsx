import { useEffect, useMemo, useRef, useState } from 'react'
import type { JotDocument } from '@/lib/db'
import { isCommandKey, keyOfEvent, normKey } from '@/lib/shortcuts'
import { commandContext, commandForKey } from '@/state/commands'
import { useUi } from '@/state/ui'
import { cn } from '@/lib/utils'
import { importFiles, newDocument, pickImport } from '@/state/actions'
import { useWorkspace } from '@/state/workspace'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { CommandPalette } from './CommandPalette'
import { PaneEmpty } from './EditorPane'
import { PaneGrid } from './PaneGrid'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { StorageWarning } from './StorageWarning'
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
          <span className="font-mono text-[11.5px] text-muted-foreground">
            or drop .md files anywhere, or{' '}
            <button type="button" onClick={() => pickImport('files')} className="underline underline-offset-2 hover:text-foreground">
              import…
            </button>
          </span>
        </div>
      </PaneEmpty>
    </section>
  )
}

export function Shell({ docs }: { docs: JotDocument[] }) {
  const panes = useWorkspace((s) => s.panes)
  const sidebarOpen = useWorkspace((s) => s.sidebarOpen)
  const docsById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs])
  const [dropping, setDropping] = useState(false)

  // App-wide keys, captured before anything else sees them, wherever focus
  // is — so a command's key wins over the editor's (the shortcut editor
  // warns before taking one of its keys). Cmd/Ctrl+S does nothing: every
  // edit already persists (ADR-008), and the browser's "Save as" would only
  // save the page. Every other key comes from the command registry
  // (state/commands.ts), with the person's own choices.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUi.getState().recordingKey) return
      const key = keyOfEvent(e)
      if (!key || !isCommandKey(key)) return
      if (key === normKey('Mod-s')) return e.preventDefault()
      const command = commandForKey(key)
      if (!command || (command.enabled && !command.enabled(commandContext(undefined)))) return
      e.preventDefault()
      e.stopPropagation()
      command.run()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
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
      <StorageWarning />
      <div className="flex min-h-0 flex-auto">
        {/* The key panel opens beside the sidebar's key row, over the panes. */}
        {sidebarOpen && (
          <>
            <Sidebar docs={docs} />
            <SidebarHandle />
          </>
        )}
        <div className="relative flex min-w-0 flex-auto">
          {docs.length === 0 ? <FirstRun /> : <PaneGrid panes={panes} docsById={docsById} />}
          <Toast />
        </div>
      </div>
      <div className="relative flex-none">
        <StatusBar docsById={docsById} />
      </div>
      <SettingsModal />
      <CommandPalette />
    </div>
  )
}
