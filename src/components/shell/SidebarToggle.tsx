import { PanelLeft } from 'lucide-react'
import { formatKey } from '@/lib/shortcuts'
import { keysOf } from '@/state/commands'
import { useWorkspace } from '@/state/workspace'

// Hide / show the sidebar (round 4, frames 1–2): last in the sidebar's
// header, after a hairline; with the sidebar hidden it moves to the start of
// the first pane's tab strip, beside the wordmark. ⌘B either way.
export function SidebarToggle() {
  const open = useWorkspace((s) => s.sidebarOpen)
  const toggle = useWorkspace((s) => s.toggleSidebar)
  const key = keysOf('toggleSidebar')[0]
  return (
    <button
      type="button"
      aria-label={open ? 'hide sidebar' : 'show sidebar'}
      title={`${open ? 'hide' : 'show'} sidebar${key ? ` (${formatKey(key)})` : ''}`}
      onClick={toggle}
      className="flex h-5 w-6 flex-none items-center justify-center rounded-sm text-secondary-foreground hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <PanelLeft size={14} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
