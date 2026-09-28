import { useLiveQuery } from 'dexie-react-hooks'
import { Monitor, Moon, Sparkles, Sun } from 'lucide-react'
import { ErrorDetail } from '@/components/review/ErrorDetail'
import { useEffect, useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { openContent } from '@/editor/sessions'
import { db, type JotDocument, type ReviewFlag } from '@/lib/db'
import { atStake, standing } from '@/review/model'
import { countText, groupDigits } from '@/lib/counts'
import { cn } from '@/lib/utils'
import { useNow } from '@/state/hooks'
import { useReview } from '@/state/review'
import { setTheme, type ThemePreference, type ThemeState } from '@/state/theme'
import { focusedPane, useWorkspace } from '@/state/workspace'

// Every cell reserves its width up front so the bar never reflows as values
// change (§1.9, T3.9): counts up to six digits, cursor up to 9999:999.
// Values sit in tabular figures inside that width.
function Cell({ label, value, width, className }: { label: string; value: string; width: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 border-l border-border-subtle px-2', className)}>
      <span className="font-normal text-muted-foreground">{label}</span>
      <span className="tabular-nums" style={{ minWidth: width }}>
        {value}
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
function ReviewControl({ doc, text }: { doc: JotDocument; text: string }) {
  const run = useReview((s) => s.runs[doc.id])
  const session = useReview((s) => s.sessions[doc.id])
  const requestReview = useReview((s) => s.requestReview)
  const retry = useReview((s) => s.run)
  const dismiss = useReview((s) => s.dismissError)
  const cancel = useReview((s) => s.cancel)
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const hasKey = !!settings?.openRouterApiKey
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
        Reviewing <span className="text-muted-foreground tabular-nums">{Math.max(0, Math.floor((now - run.startedAt) / 1000))}s</span>
        <button type="button" aria-label="cancel review" title="cancel review" onClick={() => cancel(doc.id)} className="px-0.5 text-muted-foreground hover:text-foreground">
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
            <span className="text-destructive">{run.code === 'timeout' ? 'Timed out' : 'Failed'}</span>
            {run.code !== 'timeout' && <span className="text-muted-foreground">{run.code}</span>}
          </span>
        </ErrorDetail>
        <button type="button" onClick={() => void retry(doc.id)} className="underline underline-offset-2 hover:text-foreground">
          Retry
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
        {verdict === 'current' ? 'Resume review' : verdict === 'stale' ? 'Review outdated' : 'Review style'}
      </button>
    )
    body = verdict === 'stale' ? <StalePrompt documentId={doc.id} flags={session!.flags}>{button}</StalePrompt> : button
  }
  return <div className="flex min-w-0 flex-auto items-center px-[5px] whitespace-nowrap">{body}</div>
}

// Theme switch (3f): three icons — light, dark, system — with the current
// one lit, so every choice is one click and the state is always visible.
// System's tooltip names what the OS resolves to, so the cell never lies.
const themes: { value: ThemePreference; Icon: typeof Sun }[] = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
]
function ThemeCell({ preference, resolved }: { preference: ThemePreference; resolved: 'light' | 'dark' }) {
  return (
    <div role="radiogroup" aria-label="theme" className="flex flex-none items-center gap-px border-r border-border-subtle px-[5px]">
      {themes.map(({ value, Icon }) => {
        const on = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={value}
            title={value === 'system' ? `system (now ${resolved})` : value}
            onClick={() => void setTheme(value)}
            className={cn(
              'flex h-[18px] w-5 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
              on ? 'bg-hover-lift text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={13} strokeWidth={on ? 2 : 1.75} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

// The left block never shrinks below what the review control's widest state
// ("Review outdated", the error chip) needs beside the theme icons.
const LEFT_BLOCK_MIN = 236

export function StatusBar({ docsById, theme }: { docsById: Map<string, JotDocument>; theme: ThemeState }) {
  const pane = useWorkspace(focusedPane)
  const cursor = useWorkspace((s) => s.cursor)
  const sidebarWidth = useWorkspace((s) => s.sidebarWidth)
  const doc = pane?.active ? docsById.get(pane.active) : undefined
  const text = doc ? (openContent(doc.id) ?? doc.content) : ''
  const c = countText(text)
  const cur = cursor && doc && cursor.documentId === doc.id ? cursor : { line: 1, col: 1 }

  return (
    <footer className="flex h-7 flex-none items-stretch overflow-hidden rounded-(--radius-status) border border-border-strong bg-card font-mono text-[11.5px]">
      {/* Theme and review share the left block, as wide as the sidebar so
          its edge lines up with the sidebar's (never narrower than the
          review control's widest state needs). */}
      <div className="flex flex-none items-stretch border-r border-border-subtle" style={{ width: Math.max(sidebarWidth - 1, LEFT_BLOCK_MIN) }}>
        <ThemeCell preference={theme.preference} resolved={theme.resolved} />
        {/* With no document there is nothing to review or count (6d): only
            global state remains. */}
        {doc && <ReviewControl doc={doc} text={text} />}
      </div>
      <div className="flex-auto" />
      {doc && (
        <>
          <Cell label="bytes" value={groupDigits(c.bytes)} width="7ch" />
          <Cell label="chars" value={groupDigits(c.chars)} width="7ch" />
          <Cell label="words" value={groupDigits(c.words)} width="6ch" />
          <Cell label="lines" value={groupDigits(c.lines)} width="5ch" />
          <Cell label="paras" value={groupDigits(c.paras)} width="4ch" />
          <Cell label="cursor" value={`${cur.line}:${cur.col}`} width="9ch" className="pr-2.5 font-medium" />
        </>
      )}
    </footer>
  )
}
