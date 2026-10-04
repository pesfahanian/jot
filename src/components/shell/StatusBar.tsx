import { useLiveQuery } from 'dexie-react-hooks'
import { PanelRight, PanelRightDashed, Sparkles } from 'lucide-react'
import { ErrorDetail } from '@/components/review/ErrorDetail'
import { useEffect, useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { openContent } from '@/editor/sessions'
import type { JotDocument, ReviewFlag } from '@/lib/db'
import { atStake, standing } from '@/review/model'
import { countText, groupDigits } from '@/lib/counts'
import { getSettings, providerKey, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { useNow } from '@/state/hooks'
import { useReview } from '@/state/review'
import { columnsOf, docIdOf } from '@/state/layout'
import { focusedPane, useWorkspace } from '@/state/workspace'

// Counts hug their values and pack against the bar's right edge (§1.8:
// every number is monospace, tabular). The cursor, which changes width on
// almost every keystroke, leads the group and keeps its spare room on its
// left, in the bar's empty stretch — so its changes never move anything,
// and no gap shows. A count only nudges the cells left of it when it gains
// a digit.
function Cell({ label, value, reserve, className }: { label: string; value: string; reserve?: string; className?: string }) {
  return (
    // The leading (reserving) cell has no divider: it would stand in the
    // empty stretch, apart from the text.
    <div className={cn('flex items-center border-border-subtle px-2', !reserve && 'border-l', className)}>
      <span className="text-right tabular-nums" style={reserve ? { minWidth: `calc(${reserve} + ${label.length + 1}ch)` } : undefined}>
        <span className="font-normal text-muted-foreground">{label}</span> {value}
      </span>
    </div>
  )
}

// The text changed since this review, and the review still holds undecided
// flags or accepted/edited decisions (open-decisions #23): never replaced
// silently. Resume re-anchors the flags to the new text; review again
// throws the old review away and runs on the text as it is now.
function StalePrompt({ documentId, flags, children }: { documentId: string; flags: ReviewFlag[]; children: ReactNode }) {
  const resume = useReview((s) => s.resumeReview)
  const again = useReview((s) => s.reviewAgain)
  const [open, setOpen] = useState(false)
  const { pending, changes } = atStake(flags)
  const lost = [pending && `${pending} undecided`, changes && `${changes} accepted`].filter(Boolean).join(' · ')
  const choose = (fn: (id: string) => Promise<void>) => {
    setOpen(false)
    void fn(documentId)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={10} className="flex w-[300px] flex-col gap-2.5 p-3.5 font-mono text-[11.5px]">
        <div className="font-sans text-[13px] leading-snug text-foreground">The text changed since this review.</div>
        <div className="text-muted-foreground">{lost}</div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            autoFocus
            onClick={() => choose(resume)}
            className="flex h-6 items-center rounded-md border border-ink-tertiary bg-hover-lift px-[11px] text-foreground hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            resume
          </button>
          <button
            type="button"
            onClick={() => choose(again)}
            className="flex h-6 items-center rounded-md border border-border-strong bg-popover px-[11px] text-secondary-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            review again
          </button>
        </div>
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          Resume keeps the flags and finds them in the new text. Review again discards this review.
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Review control (2f): one slot filling the rest of the bar's left block,
// holding one width across all its states so the bar never reflows.
//   idle      accent icon — a non-empty document and a key
//   disabled  mute icon — no key (click opens the key panel, 7b) or nothing
//             to review (empty document: no click target at all)
//   running   bar + elapsed seconds + cancel; editing continues, nothing
//             blocks; gives up after a minute (timeout → error)
//   error     destructive wash, the status code, retry and dismiss
//   skipped   neutral: the review declined this text (reason on hover),
//             "review anyway" and dismiss; editing the text clears it
function ReviewControl({ doc, text }: { doc: JotDocument; text: string }) {
  const run = useReview((s) => s.runs[doc.id])
  const session = useReview((s) => s.sessions[doc.id])
  const requestReview = useReview((s) => s.requestReview)
  const retry = useReview((s) => s.run)
  const dismiss = useReview((s) => s.dismissError)
  const cancel = useReview((s) => s.cancel)
  const settings = useLiveQuery(() => getSettings(), [])
  const hasKey = !!settings && !!providerKey(settings).key
  const empty = text.trim().length === 0
  const now = useNow(1000)
  // Look for a resumable session once per document.
  const loadSession = useReview((s) => s.loadSession)
  useEffect(() => void loadSession(doc.id), [doc.id, loadSession])

  let body
  if (run?.state === 'running') {
    body = (
      <span className="flex h-[18px] items-center gap-1.5 rounded-sm border border-border-strong pr-1 pl-[7px]">
        <span className="flex h-[3px] w-5 overflow-hidden rounded-full bg-ink-mute">
          <span className="jot-running-bar w-[45%] rounded-full bg-primary" />
        </span>
        reviewing <span className="text-muted-foreground tabular-nums">{Math.max(0, Math.floor((now - run.startedAt) / 1000))}s</span>
        <button type="button" aria-label="cancel review" title="cancel review" onClick={() => cancel(doc.id)} className="px-0.5 text-muted-foreground hover:text-foreground">
          ×
        </button>
      </span>
    )
  } else if (run?.state === 'skipped' && run.text === text) {
    body = (
      <span className="flex h-[18px] items-center gap-1.5 rounded-sm border border-border-strong pr-1 pl-[7px]">
        <span className="cursor-help text-muted-foreground" tabIndex={0} title={run.by === 'jot' ? `not reviewed: ${run.reason}` : `the model declined: ${run.reason}`}>
          skipped
        </span>
        <button type="button" onClick={() => void retry(doc.id, true)} className="underline underline-offset-2 hover:text-foreground">
          review anyway
        </button>
        <button type="button" aria-label="dismiss" onClick={() => dismiss(doc.id)} className="px-0.5 text-muted-foreground hover:text-foreground">
          ×
        </button>
      </span>
    )
  } else if (run?.state === 'error') {
    body = (
      <span className="flex h-[18px] items-center gap-1.5 rounded-sm border border-destructive/60 bg-destructive/10 pr-1 pl-[7px]">
        {/* Hover for the full response (debug). */}
        <ErrorDetail message={run.message} detail={run.detail}>
          <span className="flex cursor-help items-center gap-1.5" tabIndex={0}>
            <span className="text-destructive">{run.code === 'timeout' ? 'timed out' : 'failed'}</span>
            {run.code !== 'timeout' && <span className="text-muted-foreground">{run.code}</span>}
          </span>
        </ErrorDetail>
        <button type="button" onClick={() => void retry(doc.id)} className="underline underline-offset-2 hover:text-foreground">
          retry
        </button>
        <button type="button" aria-label="dismiss" onClick={() => dismiss(doc.id)} className="px-0.5 text-muted-foreground hover:text-foreground">
          ×
        </button>
      </span>
    )
  } else {
    const ready = hasKey && !empty
    const verdict = session ? standing(session.source, session.flags, text) : null
    // A spent review is replaced on the next click; until then the control
    // reads as a plain "review style".
    const live = verdict === 'current' || verdict === 'stale'
    const decided = session ? session.flags.filter((f) => f.status !== 'pending').length : 0
    const button = (
      <button
        type="button"
        // An empty document has nothing to review: no click target. With no
        // key, the disabled register still opens the key panel.
        disabled={empty && !live}
        onClick={verdict === 'stale' ? undefined : () => void requestReview(doc.id)}
        title={
          verdict === 'current'
            ? `resume review — ${decided} of ${session!.flags.length} decided`
            : verdict === 'stale'
              ? 'the text changed since this review'
              : empty
                ? 'nothing to review'
                : hasKey
                  ? 'review style'
                  : 'add an AI provider key to review'
        }
        className={cn(
          'flex h-[18px] items-center gap-1.5 rounded-sm border px-[7px]',
          ready || live ? 'border-border-strong hover:bg-hover-lift' : 'border-dashed border-border-strong text-ink-dim',
          !empty && !hasKey && 'hover:text-foreground',
        )}
      >
        <Sparkles size={12} strokeWidth={1.75} className={cn('flex-none', ready || live ? 'text-primary' : 'text-ink-mute')} aria-hidden />
        {verdict === 'current' ? 'resume review' : verdict === 'stale' ? 'review outdated' : 'review style'}
      </button>
    )
    body = verdict === 'stale' ? <StalePrompt documentId={doc.id} flags={session!.flags}>{button}</StalePrompt> : button
  }
  return <div className="flex min-w-0 flex-auto items-center px-[5px] whitespace-nowrap">{body}</div>
}

// The left block never shrinks below what the minimap toggle and the review
// control's widest state ("review outdated", the skipped chip) need.
const LEFT_BLOCK_MIN = 210

// Minimap on/off (Phase 8; in the status bar since the owner moved it), one
// setting for every editor. Lit while on. With three columns open the
// editors hide it regardless — the tooltip says so.
function MinimapToggle() {
  const on = useLiveQuery(() => getSettings().then((s) => s.minimap ?? true), []) ?? true
  const crowded = useWorkspace((s) => columnsOf(s.panes).length >= 3)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="minimap"
      title={`minimap: ${on ? 'on' : 'off'}${on && crowded ? ' (hidden with three columns)' : ''} — click to ${on ? 'hide' : 'show'}`}
      onClick={() => void updateSettings({ minimap: !on })}
      className={cn(
        'flex w-[30px] flex-none items-center justify-center border-r border-border-subtle hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        on ? 'text-secondary-foreground' : 'text-ink-dim',
      )}
    >
      {on ? <PanelRight size={13} strokeWidth={1.75} aria-hidden /> : <PanelRightDashed size={13} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

export function StatusBar({ docsById }: { docsById: Map<string, JotDocument> }) {
  const pane = useWorkspace(focusedPane)
  const cursor = useWorkspace((s) => s.cursor)
  const sidebarWidth = useWorkspace((s) => s.sidebarWidth)
  // A rendered tab counts as its document.
  const doc = pane?.active ? docsById.get(docIdOf(pane.active)) : undefined
  const text = doc ? (openContent(doc.id) ?? doc.content) : ''
  const c = countText(text)
  const cur = cursor && doc && cursor.documentId === doc.id ? cursor : { line: 1, col: 1 }

  return (
    <footer className="flex h-7 flex-none items-stretch overflow-hidden rounded-(--radius-status) border border-border-strong bg-card font-mono text-[11.5px]">
      {/* The bar is about the focused document (the theme lives in the
          sidebar foot); the one global control here is the minimap toggle,
          beside review (owner). The left block is as wide as the sidebar, so
          its edge lines up with the sidebar's. */}
      <div className="flex flex-none items-stretch border-r border-border-subtle" style={{ width: Math.max(sidebarWidth - 1, LEFT_BLOCK_MIN) }}>
        {/* With no document there is nothing to review or count (6d): only
            global state remains. */}
        <MinimapToggle />
        {doc && <ReviewControl doc={doc} text={text} />}
      </div>
      <div className="flex-auto" />
      {doc && (
        <>
          <Cell label="cursor" value={`${cur.line}:${cur.col}`} reserve="7ch" className="font-medium" />
          <Cell label="bytes" value={groupDigits(c.bytes)} />
          <Cell label="chars" value={groupDigits(c.chars)} />
          <Cell label="words" value={groupDigits(c.words)} />
          <Cell label="lines" value={groupDigits(c.lines)} />
          <Cell label="paras" value={groupDigits(c.paras)} className="pr-2.5" />
        </>
      )}
    </footer>
  )
}
