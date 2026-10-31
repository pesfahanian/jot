import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/settings/controls'
import { aiNotesInOrder, notesInOrder } from '@/lib/annotations'
import { db, type ChatMessage } from '@/lib/db'
import { cn } from '@/lib/utils'
import { kindCounts, KINDS } from '@/review/kinds'
import { useAnnotations } from '@/state/annotations'
import { useChat } from '@/state/chat'
import { useNow } from '@/state/hooks'
import { useReview } from '@/state/review'
import { useUi } from '@/state/ui'
import { useWorkspace } from '@/state/workspace'
import { TranslateDocument, TranslationCard } from './TranslateDocument'

// AI mode's chat (round 4, frame 11): the sidebar's slot at 360px. The
// actions (style review, translate document); the conversation — answers,
// proposals with a way into the results, errors where the answer would
// have been; the queued AI notes and the message box. Acts unless told not
// to: asking for a change gives proposals, a question gives an answer.

const chip = 'flex h-[22px] items-center rounded-md border border-border bg-background px-[7px] font-mono text-[11px] text-foreground hover:bg-hover-lift disabled:pointer-events-none disabled:text-ink-dim data-[state=open]:bg-hover-lift'
const quiet = 'flex h-[22px] items-center rounded-md border border-border bg-background px-[7px] font-mono text-[11px] text-secondary-foreground hover:text-foreground'
const strong = 'flex h-[22px] items-center rounded-md border border-foreground bg-foreground px-[7px] font-mono text-[11px] text-document'
const card = 'flex flex-col gap-2 rounded-lg border border-border-strong bg-popover px-3 py-2.5'
const NONE: never[] = []

function Pill({ n }: { n: number }) {
  return <span className="flex h-4 min-w-4 flex-none items-center justify-center rounded-full bg-foreground px-1 font-mono text-[10px] font-semibold text-document">{n}</span>
}

export function ChatPanel({ documentId }: { documentId: string }) {
  const doc = useLiveQuery(() => db.documents.get(documentId), [documentId])
  const messages = useChat((s) => s.byDoc[documentId]) ?? NONE
  const busy = useChat((s) => !!s.busy[documentId])
  const list = useAnnotations((s) => s.byDoc[documentId]) ?? NONE
  const queue = aiNotesInOrder(list)
  const personal = notesInOrder(list).filter((n) => n.body?.trim())
  const [draft, setDraft] = useState('')
  const [withNotes, setWithNotes] = useState(false)
  const [translating, setTranslating] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void useChat.getState().load(documentId)
    void useReview.getState().loadSession(documentId)
    box.current?.focus()
  }, [documentId])
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages.length, busy])

  const canSend = !busy && (!!draft.trim() || queue.length > 0)
  const send = () => {
    if (!canSend) return
    void useChat.getState().send(documentId, draft, withNotes)
    setDraft('')
  }
  const reviewStyle = () => {
    useChat.getState().append(documentId, { id: crypto.randomUUID(), at: Date.now(), role: 'action', action: 'review', text: 'review style' })
    void useReview.getState().requestReview(documentId)
  }

  return (
    <aside className="jot-chat-enter flex min-h-0 w-[360px] flex-none flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-card">
      <header className="flex h-[38px] flex-none items-center gap-2 border-b border-border pr-2 pl-3.5">
        <span className="text-[13px] font-semibold">ai mode</span>
        <span dir="auto" className="min-w-0 flex-auto truncate text-[13px] text-ink-tertiary">
          {doc?.title}
        </span>
        <button type="button" onClick={() => useWorkspace.getState().leaveAiMode()} className={quiet}>
          leave
        </button>
      </header>
      <div className="flex flex-none flex-wrap gap-[5px] border-b border-border-subtle px-3 py-2">
        <button type="button" className={chip} onClick={reviewStyle}>
          review style
        </button>
        <TranslateDocument documentId={documentId} open={translating} onOpenChange={setTranslating}>
          <button type="button" className={chip}>
            translate document
          </button>
        </TranslateDocument>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(chip, 'text-secondary-foreground')} disabled={!messages.length}>
              history
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <div className="px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {messages.length} message{messages.length === 1 ? '' : 's'} · kept with this document
            </div>
            <DropdownMenuItem onSelect={() => useChat.getState().clear(documentId)}>clear the conversation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div ref={scroller} className="flex min-h-0 flex-auto flex-col gap-3.5 overflow-y-auto p-3.5 text-[13px] leading-[1.55]">
        <div className="flex-auto" />
        {messages.length === 0 && !busy && (
          <div className="flex flex-col gap-1.5 text-pretty text-secondary-foreground">
            <span>Ask about this document, or ask for a change.</span>
            <span className="text-[12.5px] text-ink-tertiary">Changes come back as proposals you accept or reject. Right-click text for an AI note pinned to it; notes go with your next message.</span>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} documentId={documentId} message={m} onEdit={(t) => (setDraft(t), box.current?.focus())} />
        ))}
        {busy && <Thinking documentId={documentId} />}
      </div>
      <div className="flex flex-none flex-col gap-2 border-t border-border px-3 pt-2.5 pb-3">
        {queue.length > 0 && (
          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover">
            <div className="flex items-center border-b border-border-subtle px-2.5 py-1.5 font-mono text-[11px] text-ink-tertiary">
              <span className="flex-auto">
                {queue.length} ai note{queue.length === 1 ? '' : 's'} go{queue.length === 1 ? 'es' : ''} with your next message
              </span>
              <button type="button" className="hover:text-foreground" onClick={() => useAnnotations.getState().set(documentId, list.filter((a) => a.kind !== 'ai-note'))}>
                clear
              </button>
            </div>
            <div className="max-h-[160px] overflow-y-auto">
              {queue.map((q, i) => (
                <div key={q.id} className="flex items-start gap-2 border-b border-border-subtle px-2.5 py-[7px] last:border-b-0">
                  <span className="mt-px">
                    <Pill n={i + 1} />
                  </span>
                  <span className="flex min-w-0 flex-auto flex-col gap-px">
                    <span dir="auto" className="truncate text-left font-mono text-[11px] text-ink-tertiary">
                      {q.quote}
                    </span>
                    <span dir="auto" className="text-[12.5px]">
                      {q.body || <span className="text-ink-dim">no instruction yet</span>}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="remove this ai note"
                    className="font-mono text-[12px] text-ink-dim hover:text-foreground"
                    onClick={() => useAnnotations.getState().set(documentId, list.filter((a) => a.id !== q.id))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={cn('flex flex-col gap-2 rounded-lg border bg-document px-2.5 py-[9px]', draft ? 'border-border-strong' : 'border-border')}>
          <textarea
            ref={box}
            dir="auto"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder={queue.length ? 'add a message, or just send the notes' : 'ask, or ask for a change'}
            aria-label="message"
            className="min-h-[38px] resize-none bg-transparent text-[13px] outline-none placeholder:text-ink-dim"
          />
          <div className="flex items-center gap-2 font-mono text-[11px] text-secondary-foreground">
            <label className="flex items-center gap-1.5" title="send your own notes along, as context only">
              <Switch label="my notes as context" on={withNotes} disabled={!personal.length} onChange={setWithNotes} />
              my notes as context <span className="text-muted-foreground">{personal.length}</span>
            </label>
            <span className="flex-auto" />
            <button
              type="button"
              disabled={!canSend}
              onClick={send}
              className={cn('flex h-6 items-center rounded-md border px-[9px] font-semibold', canSend ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-ink-dim')}
            >
              send ↵
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

function Thinking({ documentId }: { documentId: string }) {
  const [started] = useState(() => Date.now())
  const now = useNow(1000)
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-ink-tertiary">
      <span className="flex h-[3px] w-5 overflow-hidden rounded-full bg-ink-mute">
        <span className="jot-running-bar w-[45%] rounded-full bg-primary" />
      </span>
      thinking {Math.floor((now - started) / 1000)}s
      <button type="button" onClick={() => useChat.getState().cancel(documentId)} className="underline underline-offset-2 hover:text-foreground">
        stop
      </button>
    </div>
  )
}

function Bubble({ children }: { children: ReactNode }) {
  return <div className="flex max-w-[290px] flex-col gap-1.5 self-end rounded-lg border border-border bg-popover px-[11px] py-2">{children}</div>
}

function Message({ documentId, message: m, onEdit }: { documentId: string; message: ChatMessage; onEdit: (text: string) => void }) {
  const session = useReview((s) => s.sessions[documentId])
  const resultsOpen = useReview((s) => Object.values(s.openIn).includes(documentId))
  const openSettings = useUi((s) => s.openSettings)

  if (m.role === 'user') {
    return (
      <Bubble>
        {m.text && (
          <span dir="auto" className="whitespace-pre-wrap">
            {m.text}
          </span>
        )}
        {(m.notes.length > 0 || m.context > 0) && (
          <span className="flex flex-wrap items-center gap-1">
            {m.notes.map((n) => (
              <Pill key={n.n} n={n.n} />
            ))}
            <span className="font-mono text-[11px] text-ink-tertiary">
              {[m.notes.length && `${m.notes.length} ai note${m.notes.length === 1 ? '' : 's'}`, m.context && `${m.context} personal note${m.context === 1 ? '' : 's'} as context`].filter(Boolean).join(' · ')}
            </span>
          </span>
        )}
      </Bubble>
    )
  }

  if (m.role === 'assistant') {
    const mine = session?.flags.filter((f) => m.keys?.includes(f.key)) ?? []
    const decided = mine.filter((f) => f.status !== 'pending').length
    return (
      <div className="flex flex-col gap-2 text-pretty">
        <span dir="auto" className="whitespace-pre-wrap">
          {m.text}
        </span>
        {m.proposals + m.unmatched === 0 ? (
          <span className="font-mono text-[11px] text-muted-foreground">answer only · nothing proposed</span>
        ) : mine.length === 0 ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {m.proposals} proposal{m.proposals === 1 ? '' : 's'} · results closed
          </span>
        ) : (
          <div className={cn('flex items-center gap-2 rounded-lg bg-popover px-2.5 py-2 font-mono text-[11px]', resultsOpen ? 'border-2 border-primary' : 'border border-border-strong')}>
            <span className="flex-auto text-secondary-foreground">
              {mine.length} proposal{mine.length === 1 ? '' : 's'} · {decided} decided
            </span>
            {resultsOpen ? (
              <span className="text-ink-tertiary">open →</span>
            ) : (
              <button type="button" className={strong} onClick={() => void useReview.getState().openResults(documentId)}>
                open results
              </button>
            )}
          </div>
        )}
        <span className="font-mono text-[10.5px] text-ink-dim">{m.model}</span>
      </div>
    )
  }

  if (m.role === 'action') {
    if (m.action === 'translate') return <TranslationCard message={m} />
    return (
      <>
        <div className="flex items-center gap-1.5 self-end rounded-lg border border-border bg-popover px-2.5 py-1.5 font-mono text-[11px]">
          review style <span className="text-muted-foreground">· action</span>
        </div>
        <ReviewResult documentId={documentId} session={session} resultsOpen={resultsOpen} />
      </>
    )
  }

  // Errors appear where the answer would have been (round 4, frame 17).
  if (m.kind === 'no-key') {
    return (
      <div className={card}>
        <span className="font-semibold">No AI key yet</span>
        <span className="text-pretty text-secondary-foreground">AI mode talks to your own provider with your own key. Add one in settings; it stays in this browser.</span>
        <span className="flex gap-1.5">
          <button type="button" className="flex h-6 items-center rounded-md bg-primary px-[9px] font-mono text-[11px] font-semibold text-primary-foreground" onClick={() => openSettings('ai')}>
            open settings
          </button>
          {m.retry && (
            <button type="button" className={quiet} onClick={() => void useChat.getState().retry(documentId, m.retry!)}>
              send again
            </button>
          )}
        </span>
      </div>
    )
  }
  if (m.kind === 'declined') {
    const original = m.retry && useChat.getState().byDoc[documentId]?.find((x) => x.id === m.retry)
    return (
      <div className={card}>
        <span className="flex items-center gap-2 font-medium">
          <span className="size-1.5 rounded-full bg-flag-check" />
          The model declined
        </span>
        <span dir="auto" className="border-l-2 border-border pl-[9px] text-[12.5px] text-pretty text-secondary-foreground">
          "{m.message}"
        </span>
        <span className="font-mono text-[11px] text-ink-tertiary">{m.model} · nothing proposed</span>
        {original && original.role === 'user' && (
          <span className="flex gap-1.5">
            <button type="button" className={quiet} onClick={() => onEdit(original.text)}>
              edit message
            </button>
          </span>
        )}
      </div>
    )
  }
  return (
    <div className={card}>
      <span className="flex items-center gap-2 font-medium">
        <span className="size-1.5 rounded-full bg-destructive" />
        The provider didn't answer
      </span>
      <span className="font-mono text-[11px] leading-relaxed break-words text-ink-tertiary">
        {m.message}
        {m.detail && (
          <>
            <br />
            {m.detail}
          </>
        )}
      </span>
      <span className="text-[12.5px] text-secondary-foreground">Your message and notes are kept. Nothing was sent twice.</span>
      {m.retry && (
        <span className="flex gap-1.5">
          <button type="button" className={strong} onClick={() => void useChat.getState().retry(documentId, m.retry!)}>
            retry
          </button>
        </span>
      )}
    </div>
  )
}

// The style review, run from AI mode: its progress, then the findings by
// kind, with the way into the results (round 4, frame 14).
function ReviewResult({ documentId, session, resultsOpen }: { documentId: string; session: ReturnType<typeof useReview.getState>['sessions'][string] | undefined; resultsOpen: boolean }) {
  const run = useReview((s) => s.runs[documentId])
  const now = useNow(1000)
  if (run?.state === 'running') {
    return (
      <span className="flex items-center gap-2 font-mono text-[11px] text-ink-tertiary">
        <span className="flex h-[3px] w-5 overflow-hidden rounded-full bg-ink-mute">
          <span className="jot-running-bar w-[45%] rounded-full bg-primary" />
        </span>
        reviewing {Math.floor((now - run.startedAt) / 1000)}s
      </span>
    )
  }
  if (run?.state === 'error') return <span className="font-mono text-[11px] text-destructive">the review failed · {run.message}</span>
  if (run?.state === 'skipped') return <span className="font-mono text-[11px] text-muted-foreground">not reviewed · {run.reason}</span>
  const styleFlags = session?.flags.filter((f) => f.family !== 'chat') ?? []
  if (!styleFlags.length) return <span className="font-mono text-[11px] text-muted-foreground">no findings</span>
  return (
    <div className="flex flex-col gap-2">
      <span>
        Style review done. {styleFlags.length} finding{styleFlags.length === 1 ? '' : 's'}.
      </span>
      <div className={cn('flex flex-col gap-1.5 rounded-lg bg-popover px-2.5 py-[9px] font-mono text-[11px] text-secondary-foreground', resultsOpen ? 'border-2 border-primary' : 'border border-border-strong')}>
        {kindCounts(styleFlags).map((k) => (
          <span key={k.kind} className="flex items-center gap-[7px]">
            <span className="size-2" style={{ background: KINDS[k.kind].ink }} />
            <span className="flex-auto">{KINDS[k.kind].name.toLowerCase()}</span>
            <span className="text-foreground">{k.total}</span>
          </span>
        ))}
        {!resultsOpen && (
          <button type="button" className={cn(strong, 'self-end')} onClick={() => void useReview.getState().openResults(documentId)}>
            open results
          </button>
        )}
      </div>
    </div>
  )
}
