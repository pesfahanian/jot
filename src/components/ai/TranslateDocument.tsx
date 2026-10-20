import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TARGETS } from '@/ai/translateDocument'
import { db, type ChatMessage } from '@/lib/db'
import { directionOf } from '@/lib/direction'
import { cn } from '@/lib/utils'
import { openContent } from '@/editor/sessions'
import { useTranslation } from '@/state/translation'
import { useWorkspace } from '@/state/workspace'

// Full translation (round 4, frame 15): pick a language; a new document
// fills section by section beside the original, which stays as it is.

export function TranslateDocument({ documentId, open, onOpenChange, children }: { documentId: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const doc = useLiveQuery(() => db.documents.get(documentId), [documentId])
  // Farsi into English, anything else into Farsi — the two Jot knows best.
  const rtl = doc ? directionOf(openContent(documentId) ?? doc.content) === 'rtl' : false
  const first = rtl ? 'en' : 'fa'
  const rest = Object.keys(TARGETS).filter((t) => t !== first && t !== (rtl ? 'fa' : 'en'))
  const go = (target: string) => {
    onOpenChange(false)
    void useTranslation.getState().start(documentId, target)
  }
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[230px]">
        <div className="px-2.5 pt-1 pb-1.5 text-[12px] leading-snug text-pretty text-ink-tertiary">Into a new document beside this one. The original stays as it is.</div>
        <DropdownMenuItem onSelect={() => go(first)}>
          <span className="flex-auto">into {TARGETS[first].name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{TARGETS[first].native}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {rest.map((t) => (
          <DropdownMenuItem key={t} onSelect={() => go(t)}>
            <span className="flex-auto">into {TARGETS[t].name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{TARGETS[t].native}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const button = 'flex h-[22px] items-center rounded-md border border-border bg-background px-[7px] font-mono text-[11px] text-secondary-foreground hover:text-foreground'

export function TranslationCard({ message }: { message: Extract<ChatMessage, { role: 'action' }> }) {
  const run = useTranslation((s) => s.runs[message.id])
  const draft = useLiveQuery(() => (message.documentId ? db.documents.get(message.documentId) : undefined), [message.documentId])
  const show = () => {
    if (!draft) return
    const ws = useWorkspace.getState()
    const pane = ws.panes.find((p) => p.tabs.includes(draft.id))
    if (pane) ws.activateTab(pane.id, draft.id)
    else ws.openBeside(draft.id)
  }
  const total = run?.sections.length ?? 0
  const status = !run ? 'stopped' : run.state === 'running' ? `translating · section ${Math.min(run.done + 1, total)} of ${total}` : run.state === 'done' ? `done · ${total} section${total === 1 ? '' : 's'}` : run.state === 'failed' ? 'stopped by an error' : 'stopped'
  return (
    <>
      <div className="flex max-w-[290px] self-end rounded-lg border border-border bg-popover px-[11px] py-2">{message.text}</div>
      <div className="flex flex-col gap-2">
        <span>
          {draft ? (
            <>
              Writing a new document,{' '}
              <span dir="auto" className="font-medium">
                {draft.title}
              </span>
              . The original stays as it is.
            </>
          ) : (
            'The translated draft was deleted.'
          )}
        </span>
        <div className="flex flex-col gap-[7px] rounded-lg border border-border-strong bg-popover px-2.5 py-[9px] font-mono text-[11px] text-secondary-foreground">
          <span className="flex items-center gap-2">
            <span className="flex-auto text-foreground">{status}</span>
            {run && <span>{run.done} / {total}</span>}
          </span>
          {run && (
            // One segment per section; it jumps as each lands.
            <span className="flex h-1 gap-0.5">
              {run.sections.map((_, i) => (
                <span key={i} className={cn('flex-1 rounded-[1px]', i < run.done ? 'bg-secondary-foreground' : 'bg-hover-lift')} />
              ))}
            </span>
          )}
          {run?.error && <span className="leading-relaxed text-destructive">{run.error}</span>}
          <span className="flex items-center gap-2">
            <span className="flex-auto text-ink-tertiary">{run?.state === 'running' ? 'no decisions: it’s a fresh draft' : !run ? 'the page was reloaded while it ran' : ''}</span>
            {run?.state === 'running' && (
              <button type="button" className={button} onClick={() => useTranslation.getState().stop(message.id)}>
                stop
              </button>
            )}
            {(run?.state === 'failed' || run?.state === 'stopped') && draft && (
              <button type="button" className={button} onClick={() => void useTranslation.getState().resume(message.id)}>
                go on
              </button>
            )}
            {draft && (
              <button type="button" className={button} onClick={show}>
                open
              </button>
            )}
          </span>
        </div>
      </div>
    </>
  )
}
