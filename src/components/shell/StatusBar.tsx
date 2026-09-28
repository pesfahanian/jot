import { useLiveQuery } from 'dexie-react-hooks'
import { ErrorDetail } from '@/components/review/ErrorDetail'
import { useEffect } from 'react'
import { openContent } from '@/editor/sessions'
import { db, type JotDocument } from '@/lib/db'
import { countText, groupDigits } from '@/lib/counts'
import { cn } from '@/lib/utils'
import { useNow } from '@/state/hooks'
import { useReview } from '@/state/review'
import { cycleTheme, type ThemePreference, type ThemeState } from '@/state/theme'
import { focusedPane, useWorkspace } from '@/state/workspace'

// Every cell reserves its width up front so the bar never reflows as values
// change (§1.9, T3.9): counts up to six digits, cursor up to 9999:999.
// Values sit in tabular figures inside that width.
function Cell({ label, value, width, className }: { label: string; value: string; width: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 border-l border-border-subtle px-[11px]', className)}>
      <span className="font-normal text-muted-foreground">{label}</span>
      <span className="tabular-nums" style={{ minWidth: width }}>
        {value}
      </span>
    </div>
  )
}

// Review control (2f): one fixed slot, left of everything else, holding one
// width across all four states so the bar never reflows.
//   idle      accent dot — a non-empty document and a usable key
//   disabled  mute dot — no key (click opens the key panel, 7b) or nothing
//             to review (empty document: no click target at all)
//   running   bar + elapsed seconds; editing continues, nothing blocks
//   error     destructive wash, the status code, retry and dismiss
function ReviewControl({ doc, text }: { doc: JotDocument; text: string }) {
  const run = useReview((s) => s.runs[doc.id])
  const session = useReview((s) => s.sessions[doc.id])
  const requestReview = useReview((s) => s.requestReview)
  const retry = useReview((s) => s.run)
  const dismiss = useReview((s) => s.dismissError)
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const hasKey = !!settings?.openRouterApiKey && settings.keyStatus !== 'invalid'
  const empty = text.trim().length === 0
  const now = useNow(1000)
  // Look for a resumable session once per document.
  const loadSession = useReview((s) => s.loadSession)
  useEffect(() => void loadSession(doc.id), [doc.id, loadSession])

  let body
  if (run?.state === 'running') {
    body = (
      <span className="flex h-[18px] items-center gap-1.5 rounded-sm border border-border-strong px-[7px]">
        <span className="flex h-[3px] w-5 overflow-hidden rounded-full bg-ink-mute">
          <span className="jot-running-bar w-[45%] rounded-full bg-primary" />
        </span>
        reviewing <span className="text-muted-foreground tabular-nums">{Math.max(0, Math.floor((now - run.startedAt) / 1000))}s</span>
      </span>
    )
  } else if (run?.state === 'error') {
    body = (
      <span className="flex h-[18px] items-center gap-1.5 rounded-sm border border-destructive/60 bg-destructive/10 pr-1 pl-[7px]">
        {/* Hover for the full response (debug). */}
        <ErrorDetail message={run.message} detail={run.detail}>
          <span className="flex cursor-help items-center gap-1.5" tabIndex={0}>
            <span className="text-destructive">review failed</span>
            <span className="text-muted-foreground">{run.code}</span>
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
    const decided = session ? session.flags.filter((f) => f.status !== 'pending').length : 0
    body = (
      <button
        type="button"
        // An empty document has nothing to review: no click target. With no
        // key, the disabled register still opens the key panel.
        disabled={empty && !session}
        onClick={() => void requestReview(doc.id)}
        title={session ? `resume review — ${decided} of ${session.flags.length} decided` : empty ? 'nothing to review' : hasKey ? 'review style' : 'add an OpenRouter key to review'}
        className={cn(
          'flex h-[18px] items-center gap-1.5 rounded-sm border px-[7px]',
          ready || session ? 'border-border-strong hover:bg-hover-lift' : 'border-dashed border-border-strong text-ink-dim',
          !empty && !hasKey && 'hover:text-foreground',
        )}
      >
        <span className={cn('size-[5px] rounded-[2px]', ready || session ? 'bg-primary' : 'bg-ink-mute')} />
        {session ? 'resume review' : 'review style'}
      </button>
    )
  }
  return <div className="flex w-[200px] flex-none items-center border-r border-border-subtle px-[5px] whitespace-nowrap">{body}</div>
}

// Key cell (7c): same label-plus-value shape as the theme cell; a quiet,
// persistent door to the key panel. No dot when valid — the ready dot on the
// review control beside it already says so.
function KeyCell() {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const testing = useReview((s) => s.keyTesting)
  const open = useReview((s) => s.keyPanel.open)
  const openKeyPanel = useReview((s) => s.openKeyPanel)
  const closeKeyPanel = useReview((s) => s.closeKeyPanel)
  const key = settings?.openRouterApiKey
  let value
  if (testing) {
    value = (
      <span className="flex items-center gap-1.5">
        <span className="flex h-[3px] w-5 overflow-hidden rounded-full bg-ink-mute">
          <span className="jot-running-bar w-[45%] rounded-full bg-primary" />
        </span>
        testing
      </span>
    )
  } else if (!key) value = <span className="text-secondary-foreground">not set</span>
  else if (settings.keyStatus === 'invalid') value = <span className="text-destructive">rejected</span>
  else if (settings.keyStatus === 'offline')
    value = (
      <span>
        set <span className="text-muted-foreground">unchecked</span>
      </span>
    )
  else value = <span>set</span>
  return (
    <button
      type="button"
      data-key-cell=""
      onClick={() => (open ? closeKeyPanel() : openKeyPanel('cell'))}
      className={cn(
        'flex items-center gap-1.5 border-r border-border-subtle px-[11px] hover:bg-hover-lift focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        open && 'bg-popover',
      )}
    >
      <span className="text-muted-foreground">key</span>
      <span className="min-w-[13ch] text-left">{value}</span>
    </button>
  )
}

// Theme switch (3f): text, not an icon, cycling light → dark → system; system
// appends what the OS resolves to, so the cell never lies.
function ThemeCell({ preference, resolved }: { preference: ThemePreference; resolved: 'light' | 'dark' }) {
  return (
    <button
      type="button"
      onClick={() => void cycleTheme(preference)}
      title="switch theme"
      className="flex items-center gap-1.5 border-l border-border-subtle pr-3 pl-[11px] hover:bg-hover-lift focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <span className="text-muted-foreground">theme</span>
      <span className="min-w-[14ch] text-left">
        {preference}
        {preference === 'system' && <span className="text-muted-foreground"> · {resolved}</span>}
      </span>
    </button>
  )
}

export function StatusBar({ docsById, theme }: { docsById: Map<string, JotDocument>; theme: ThemeState }) {
  const pane = useWorkspace(focusedPane)
  const cursor = useWorkspace((s) => s.cursor)
  const doc = pane?.active ? docsById.get(pane.active) : undefined
  const text = doc ? (openContent(doc.id) ?? doc.content) : ''
  const c = countText(text)
  const cur = cursor && doc && cursor.documentId === doc.id ? cursor : { line: 1, col: 1 }

  return (
    <footer className="flex h-7 flex-none items-stretch overflow-hidden rounded-(--radius-status) border border-border-strong bg-card font-mono text-[11.5px]">
      {/* With no document there is nothing to review or count (6d): only
          global state remains. */}
      {doc && (
        <>
          <ReviewControl doc={doc} text={text} />
          <KeyCell />
        </>
      )}
      <div className="flex-auto" />
      {doc && (
        <>
          <Cell label="bytes" value={groupDigits(c.bytes)} width="7ch" />
          <Cell label="chars" value={groupDigits(c.chars)} width="7ch" />
          <Cell label="words" value={groupDigits(c.words)} width="6ch" />
          <Cell label="lines" value={groupDigits(c.lines)} width="5ch" />
          <Cell label="paras" value={groupDigits(c.paras)} width="4ch" />
          <Cell label="cursor" value={`${cur.line}:${cur.col}`} width="9ch" className="font-medium" />
        </>
      )}
      <ThemeCell preference={theme.preference} resolved={theme.resolved} />
    </footer>
  )
}
