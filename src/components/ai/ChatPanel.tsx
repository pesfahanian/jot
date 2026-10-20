import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useWorkspace } from '@/state/workspace'

// AI mode's chat (round 4, frame 11): the sidebar's slot at 360px. Header
// with the document and a way out; the actions (style review, translate);
// the conversation; the queued AI notes and the message box.

const chip = 'flex h-[22px] items-center rounded-md border border-border bg-background px-[7px] font-mono text-[11px] text-foreground hover:bg-hover-lift disabled:pointer-events-none disabled:text-ink-dim'

export function ChatPanel({ documentId }: { documentId: string }) {
  const doc = useLiveQuery(() => db.documents.get(documentId), [documentId])
  return (
    <aside className="jot-chat-enter flex w-[360px] min-h-0 flex-none flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-card">
      <header className="flex h-[38px] flex-none items-center gap-2 border-b border-border pr-2 pl-3.5">
        <span className="text-[13px] font-semibold">ai mode</span>
        <span dir="auto" className="min-w-0 flex-auto truncate text-[13px] text-ink-tertiary">
          {doc?.title}
        </span>
        <button type="button" onClick={() => useWorkspace.getState().leaveAiMode()} className="flex h-[22px] items-center gap-1.5 rounded-md border border-border bg-background px-[7px] font-mono text-[11px] text-secondary-foreground hover:text-foreground">
          leave <span className="text-muted-foreground">esc</span>
        </button>
      </header>
      <div className="flex flex-none flex-wrap gap-[5px] border-b border-border-subtle px-3 py-2">
        <button type="button" className={chip} disabled>
          review style
        </button>
        <button type="button" className={chip} disabled>
          translate document
        </button>
      </div>
      <div className="flex min-h-0 flex-auto flex-col justify-end gap-3.5 overflow-y-auto p-3.5 text-[13px] leading-[1.55]" />
    </aside>
  )
}
