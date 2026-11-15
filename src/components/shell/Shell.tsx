import { useEffect, useMemo, useRef, useState } from 'react'
import type { JotDocument } from '@/lib/db'
import { isCommandKey, keyOfEvent, normKey } from '@/lib/shortcuts'
import { commandContext, commandForKey } from '@/state/commands'
import { useUi } from '@/state/ui'
import { cn } from '@/lib/utils'
import { importFiles, pickImport } from '@/state/actions'
import { useWorkspace } from '@/state/workspace'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { CommandPalette } from './CommandPalette'
import { NotePopover } from '@/components/annotations/NotePopover'
import { SelectionMenu } from '@/components/annotations/SelectionMenu'
import { TranslatePopover } from '@/components/annotations/TranslatePopover'
import { TypoMenu } from '@/components/annotations/TypoMenu'
import { activeEditor } from '@/editor/annotations'
import { PaneEmpty } from './EditorPane'
import { PaneGrid } from './PaneGrid'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { StorageWarning } from './StorageWarning'
import { Toast } from './Toast'

// Comfy mode's way out (owner, 2026-11-15): a faint "leave" at the top
// right that shows while the mouse moves and fades when it rests, so
// writing has nothing else on screen. Esc and the key leave too.
function ComfyLeave() {
  const leave = useWorkspace((s) => s.leaveComfy)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const move = () => {
      setShown(true)
      clearTimeout(timer)
      timer = setTimeout(() => setShown(false), 1800)
    }
    window.addEventListener('mousemove', move)
    return () => {
      window.removeEventListener('mousemove', move)
      clearTimeout(timer)
    }
  }, [])
  return (
    <button
      type="button"
      onClick={leave}
      title="leave comfy mode"
      className={cn(
        'absolute top-3 right-4 z-30 rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground transition-opacity duration-(--motion-base) hover:bg-hover-lift hover:text-foreground focus-visible:opacity-100',
        shown ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      leave
    </button>
  )
}

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
            onClick={() => useWorkspace.getState().startDraft()}
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
  const comfy = useWorkspace((s) => !!s.comfy)
  const draft = useWorkspace((s) => !!s.draft)
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
      // Esc leaves comfy mode, unless something on top (a menu, a popover,
      // the find panel, a name field) is what Esc should close, or the
      // editor has several cursors to collapse.
      if (e.key === 'Escape' && useWorkspace.getState().comfy && !e.defaultPrevented) {
        const layered =
          document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"]') ||
          (e.target as Element).closest?.('.cm-panels, [data-rename-field], textarea, input') ||
          (activeEditor()?.view.state.selection.ranges.length ?? 0) > 1
        if (!layered) {
          e.preventDefault()
          useWorkspace.getState().leaveComfy()
          return
        }
      }
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
      data-comfy={comfy || undefined}
      className={cn(
        'flex h-svh flex-col gap-(--seam) overflow-hidden rounded-(--radius-tray) border border-border-tray bg-background p-(--tray-pad) text-foreground',
        dropping && 'outline-2 -outline-offset-2 outline-primary',
      )}
    >
      {!comfy && <StorageWarning />}
      <div className="flex min-h-0 flex-auto">
        {sidebarOpen && !comfy && (
          <>
            <Sidebar docs={docs} />
            <SidebarHandle />
          </>
        )}
        {/* The status bar is about the document, so it sits under the panes
            only; the sidebar runs the full height (owner, 2026-11-15). */}
        <div className="flex min-w-0 flex-auto flex-col gap-(--seam)">
          <div className="relative flex min-h-0 flex-auto">
            {docs.length === 0 && !draft ? <FirstRun /> : <PaneGrid panes={panes} docsById={docsById} />}
            <Toast />
            {comfy && <ComfyLeave />}
          </div>
          {!comfy && (
            <div className="relative flex-none">
              <StatusBar docsById={docsById} />
            </div>
          )}
        </div>
      </div>
      <SettingsModal />
      <CommandPalette />
      <SelectionMenu />
      <NotePopover />
      <TranslatePopover />
      <TypoMenu />
    </div>
  )
}
